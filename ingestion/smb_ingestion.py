#!/usr/bin/env python3
"""
SMB/CIFS Network Share Integration

Provides integration with Microsoft shared folders and network drives for accessing
Access databases, Excel files, and other oil & gas data stored on corporate networks.
"""

import os
import logging
import tempfile
import subprocess
from pathlib import Path
from typing import List, Dict, Optional
import re
from datetime import datetime

from .credential_manager import CredentialManager


class SMBIngestionClient:
    """Client for accessing SMB/CIFS network shares"""
    
    def __init__(self, server: str, share: str, username: str = None,
                 password: str = None, domain: str = None,
                 credential_key: str = None):
        self.server = server
        self.share = share
        self.username = username
        self.password = password
        self.domain = domain
        self.credential_key = credential_key
        self.logger = logging.getLogger(__name__)
        
        # Initialize credentials if key provided
        if credential_key:
            cred_manager = CredentialManager()
            creds = cred_manager.get_credentials(credential_key)
            self.username = creds.get('username', username)
            self.password = creds.get('password', password)
            self.domain = creds.get('domain', domain)
        
        # Construct UNC path
        self.unc_path = f"//{self.server}/{self.share}"
    
    def test_connection(self) -> bool:
        """Test SMB connection"""
        try:
            # Use smbclient to test connection
            cmd = self._build_smbclient_command("ls")
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                self.logger.info(f"SMB connection successful: {self.unc_path}")
                return True
            else:
                self.logger.error(f"SMB connection failed: {result.stderr}")
                return False
        
        except Exception as e:
            self.logger.error(f"SMB connection test failed: {e}")
            return False
    
    def _build_smbclient_command(self, operation: str, **kwargs) -> List[str]:
        """Build smbclient command with authentication"""
        cmd = ["smbclient", self.unc_path]
        
        # Authentication
        if self.username:
            if self.domain:
                cmd.extend(["-U", f"{self.domain}\\{self.username}"])
            else:
                cmd.extend(["-U", self.username])
        
        if self.password:
            cmd.extend(["-A", "/dev/stdin"])  # We'll pass password via stdin
        
        # Operation-specific arguments
        if operation == "ls":
            cmd.extend(["-c", "ls"])
        elif operation == "get":
            remote_file = kwargs.get('remote_file')
            local_file = kwargs.get('local_file')
            cmd.extend(["-c", f"get {remote_file} {local_file}"])
        elif operation == "recurse":
            cmd.extend(["-c", "recurse ON; prompt OFF; ls"])
        
        return cmd
    
    def discover_files(self, remote_path: str = "", 
                      file_patterns: List[str] = None) -> List[Dict]:
        """Discover files on SMB share"""
        if not file_patterns:
            file_patterns = [r'.*\.accdb$', r'.*\.mdb$', r'.*\.xlsx?$', r'.*\.csv$']
        
        discovered_files = []
        
        try:
            # List files using smbclient
            cmd = ["smbclient", self.unc_path]
            
            if self.username:
                if self.domain:
                    cmd.extend(["-U", f"{self.domain}\\{self.username}"])
                else:
                    cmd.extend(["-U", self.username])
            
            # Build directory listing command
            list_cmd = "recurse ON; prompt OFF; ls"
            if remote_path:
                list_cmd = f"cd {remote_path}; " + list_cmd
            
            cmd.extend(["-c", list_cmd])
            
            # Execute with password if available
            if self.password:
                result = subprocess.run(
                    cmd, 
                    input=self.password,
                    capture_output=True,
                    text=True,
                    timeout=60
                )
            else:
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            
            if result.returncode == 0:
                discovered_files = self._parse_smbclient_output(result.stdout, file_patterns)
            else:
                self.logger.error(f"SMB file discovery failed: {result.stderr}")
        
        except Exception as e:
            self.logger.error(f"SMB file discovery failed: {e}")
        
        return discovered_files
    
    def _parse_smbclient_output(self, output: str, patterns: List[str]) -> List[Dict]:
        """Parse smbclient ls output"""
        files = []
        current_dir = ""
        
        for line in output.split('\n'):
            line = line.strip()
            
            # Track current directory
            if line.startswith('\\'):
                current_dir = line
                continue
            
            # Parse file entries
            # Format: "  filename    A    size  date time"
            if line and not line.startswith(('Domain=', 'OS=', 'Server=')):
                parts = line.split()
                if len(parts) >= 4 and parts[1] in ['A', 'D']:  # A=Archive, D=Directory
                    filename = parts[0]
                    attr = parts[1]
                    
                    # Skip directories
                    if attr == 'D':
                        continue
                    
                    # Check if file matches patterns
                    for pattern in patterns:
                        if re.match(pattern, filename, re.IGNORECASE):
                            try:
                                size = int(parts[2])
                                # Construct full path
                                if current_dir:
                                    full_path = f"{current_dir}\\{filename}".replace('\\', '/')
                                else:
                                    full_path = filename
                                
                                files.append({
                                    'remote_path': full_path,
                                    'filename': filename,
                                    'size': size,
                                    'modified': None,  # smbclient doesn't provide reliable dates
                                    'type': self._get_file_type(filename)
                                })
                            except (ValueError, IndexError):
                                continue
                            break
        
        return files
    
    def download_files(self, files: List[Dict], local_directory: str) -> List[str]:
        """Download files from SMB share"""
        local_dir = Path(local_directory)
        local_dir.mkdir(parents=True, exist_ok=True)
        
        downloaded_files = []
        
        for file_info in files:
            remote_path = file_info['remote_path']
            local_path = local_dir / file_info['filename']
            
            try:
                # Build smbclient get command
                cmd = ["smbclient", self.unc_path]
                
                if self.username:
                    if self.domain:
                        cmd.extend(["-U", f"{self.domain}\\{self.username}"])
                    else:
                        cmd.extend(["-U", self.username])
                
                cmd.extend(["-c", f"get {remote_path} {local_path}"])
                
                # Execute download
                if self.password:
                    result = subprocess.run(
                        cmd,
                        input=self.password,
                        capture_output=True,
                        text=True,
                        timeout=300
                    )
                else:
                    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
                
                if result.returncode == 0 and local_path.exists():
                    downloaded_files.append(str(local_path))
                    self.logger.info(f"Downloaded: {remote_path} -> {local_path}")
                else:
                    self.logger.error(f"Failed to download {remote_path}: {result.stderr}")
            
            except Exception as e:
                self.logger.error(f"Download failed for {remote_path}: {e}")
        
        return downloaded_files
    
    def _get_file_type(self, filename: str) -> str:
        """Determine file type from extension"""
        ext = Path(filename).suffix.lower()
        type_map = {
            '.accdb': 'access_db',
            '.mdb': 'access_db',
            '.xlsx': 'excel_spreadsheet',
            '.xls': 'excel_spreadsheet',
            '.csv': 'data_table',
            '.txt': 'text_file',
            '.las': 'well_log',
            '.shp': 'shapefile'
        }
        return type_map.get(ext, 'unknown')


class NetworkDriveClient:
    """Client for network drive mounting and access"""
    
    def __init__(self, drive_letter: str = None):
        self.drive_letter = drive_letter
        self.logger = logging.getLogger(__name__)
        self.mounted_drives = {}
    
    def mount_smb_share(self, server: str, share: str, username: str = None,
                       password: str = None, domain: str = None,
                       credential_key: str = None) -> Optional[str]:
        """Mount SMB share to available drive letter"""
        
        # Get credentials if key provided
        if credential_key:
            cred_manager = CredentialManager()
            creds = cred_manager.get_credentials(credential_key)
            username = creds.get('username', username)
            password = creds.get('password', password)
            domain = creds.get('domain', domain)
        
        # Find available drive letter if not specified
        if not self.drive_letter:
            self.drive_letter = self._find_available_drive_letter()
        
        if not self.drive_letter:
            self.logger.error("No available drive letters")
            return None
        
        try:
            unc_path = f"\\\\{server}\\{share}"
            
            # Build net use command
            cmd = ["net", "use", f"{self.drive_letter}:", unc_path]
            
            if username:
                if domain:
                    cmd.extend([f"/user:{domain}\\{username}"])
                else:
                    cmd.extend([f"/user:{username}"])
            
            if password:
                cmd.append(password)
            
            # Execute mount command
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                mount_point = f"{self.drive_letter}:\\"
                self.mounted_drives[mount_point] = {
                    'server': server,
                    'share': share,
                    'unc_path': unc_path
                }
                self.logger.info(f"Mounted {unc_path} to {mount_point}")
                return mount_point
            else:
                self.logger.error(f"Mount failed: {result.stderr}")
                return None
        
        except Exception as e:
            self.logger.error(f"Mount failed: {e}")
            return None
    
    def unmount_drive(self, drive_path: str) -> bool:
        """Unmount network drive"""
        try:
            cmd = ["net", "use", drive_path.rstrip('\\'), "/delete", "/y"]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                if drive_path in self.mounted_drives:
                    del self.mounted_drives[drive_path]
                self.logger.info(f"Unmounted drive: {drive_path}")
                return True
            else:
                self.logger.error(f"Unmount failed: {result.stderr}")
                return False
        
        except Exception as e:
            self.logger.error(f"Unmount failed: {e}")
            return False
    
    def _find_available_drive_letter(self) -> Optional[str]:
        """Find available drive letter"""
        # Check drive letters Z to A (reverse order)
        for letter in "ZYXWVUTSRQPONMLKJIHGFEDCBA":
            try:
                result = subprocess.run(
                    ["fsutil", "fsinfo", "drives"],
                    capture_output=True, text=True, timeout=10
                )
                
                if result.returncode == 0:
                    used_drives = result.stdout
                    if f"{letter}:" not in used_drives:
                        return letter
                        
            except Exception:
                continue
        
        return None
    
    def discover_files_on_drive(self, drive_path: str, 
                               file_patterns: List[str] = None) -> List[Dict]:
        """Discover files on mounted drive"""
        if not file_patterns:
            file_patterns = [r'.*\.accdb$', r'.*\.mdb$', r'.*\.xlsx?$']
        
        discovered_files = []
        
        if not os.path.exists(drive_path):
            self.logger.error(f"Drive path not accessible: {drive_path}")
            return discovered_files
        
        try:
            for root, dirs, files in os.walk(drive_path):
                for filename in files:
                    for pattern in file_patterns:
                        if re.match(pattern, filename, re.IGNORECASE):
                            full_path = os.path.join(root, filename)
                            try:
                                stat = os.stat(full_path)
                                discovered_files.append({
                                    'local_path': full_path,
                                    'filename': filename,
                                    'size': stat.st_size,
                                    'modified': stat.st_mtime,
                                    'type': self._get_file_type(filename)
                                })
                            except OSError:
                                continue
                            break
        
        except Exception as e:
            self.logger.error(f"File discovery failed: {e}")
        
        return discovered_files
    
    def _get_file_type(self, filename: str) -> str:
        """Determine file type from extension"""
        ext = Path(filename).suffix.lower()
        type_map = {
            '.accdb': 'access_db',
            '.mdb': 'access_db',
            '.xlsx': 'excel_spreadsheet',
            '.xls': 'excel_spreadsheet',
            '.csv': 'data_table'
        }
        return type_map.get(ext, 'unknown')
    
    def cleanup(self):
        """Cleanup mounted drives"""
        for drive_path in list(self.mounted_drives.keys()):
            self.unmount_drive(drive_path)


# Factory functions
def create_smb_client(config: Dict) -> SMBIngestionClient:
    """Create SMB client from configuration"""
    return SMBIngestionClient(
        server=config['server'],
        share=config['share'],
        username=config.get('username'),
        password=config.get('password'),
        domain=config.get('domain'),
        credential_key=config.get('credential_key')
    )


def create_network_drive_client(config: Dict) -> NetworkDriveClient:
    """Create network drive client from configuration"""
    return NetworkDriveClient(
        drive_letter=config.get('drive_letter')
    )