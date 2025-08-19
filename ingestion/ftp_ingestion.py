#!/usr/bin/env python3
"""
FTP/SFTP Data Ingestion Client

Connects to FTP and SFTP servers to download LAS files, shapefiles, and other
oil & gas data formats. Supports secure authentication and automated file discovery.
"""

import os
import logging
import ftplib
import paramiko
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime
import re

from .credential_manager import CredentialManager


class FTPIngestionClient:
    """Client for ingesting data from FTP servers"""
    
    def __init__(self, host: str, port: int = 21, username: str = None, 
                 password: str = None, credential_key: str = None):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.credential_key = credential_key
        self.logger = logging.getLogger(__name__)
        
        # Initialize credentials if key provided
        if credential_key:
            cred_manager = CredentialManager()
            creds = cred_manager.get_credentials(credential_key)
            self.username = creds.get('username', username)
            self.password = creds.get('password', password)
    
    def connect(self) -> ftplib.FTP:
        """Establish FTP connection"""
        try:
            ftp = ftplib.FTP()
            ftp.connect(self.host, self.port)
            
            if self.username and self.password:
                ftp.login(self.username, self.password)
            else:
                ftp.login()  # Anonymous login
            
            self.logger.info(f"Connected to FTP server: {self.host}")
            return ftp
        except Exception as e:
            self.logger.error(f"FTP connection failed: {e}")
            raise
    
    def discover_files(self, remote_path: str = "/", 
                      file_patterns: List[str] = None) -> List[Dict]:
        """Discover files matching patterns on FTP server"""
        if not file_patterns:
            file_patterns = [r'.*\.las$', r'.*\.shp$', r'.*\.accdb$', r'.*\.mdb$']
        
        discovered_files = []
        
        try:
            with self.connect() as ftp:
                # Recursively search directories
                discovered_files.extend(
                    self._recursive_file_search(ftp, remote_path, file_patterns)
                )
        except Exception as e:
            self.logger.error(f"File discovery failed: {e}")
        
        return discovered_files
    
    def _recursive_file_search(self, ftp: ftplib.FTP, path: str, 
                              patterns: List[str]) -> List[Dict]:
        """Recursively search for files matching patterns"""
        files = []
        
        try:
            # List directory contents
            file_list = []
            ftp.retrlines(f'LIST {path}', file_list.append)
            
            for line in file_list:
                parts = line.split()
                if len(parts) < 9:
                    continue
                
                permissions = parts[0]
                filename = ' '.join(parts[8:])
                full_path = f"{path.rstrip('/')}/{filename}"
                
                if permissions.startswith('d'):
                    # Directory - recurse
                    files.extend(self._recursive_file_search(ftp, full_path, patterns))
                else:
                    # File - check patterns
                    for pattern in patterns:
                        if re.match(pattern, filename, re.IGNORECASE):
                            files.append({
                                'remote_path': full_path,
                                'filename': filename,
                                'size': int(parts[4]) if parts[4].isdigit() else 0,
                                'modified': self._parse_ftp_date(' '.join(parts[5:8])),
                                'type': self._get_file_type(filename)
                            })
                            break
        except Exception as e:
            self.logger.warning(f"Error searching path {path}: {e}")
        
        return files
    
    def download_files(self, files: List[Dict], local_directory: str) -> List[str]:
        """Download files to local directory"""
        local_dir = Path(local_directory)
        local_dir.mkdir(parents=True, exist_ok=True)
        
        downloaded_files = []
        
        try:
            with self.connect() as ftp:
                for file_info in files:
                    remote_path = file_info['remote_path']
                    local_path = local_dir / file_info['filename']
                    
                    try:
                        with open(local_path, 'wb') as f:
                            ftp.retrbinary(f'RETR {remote_path}', f.write)
                        
                        downloaded_files.append(str(local_path))
                        self.logger.info(f"Downloaded: {remote_path} -> {local_path}")
                    
                    except Exception as e:
                        self.logger.error(f"Failed to download {remote_path}: {e}")
        
        except Exception as e:
            self.logger.error(f"Download session failed: {e}")
        
        return downloaded_files
    
    def _parse_ftp_date(self, date_str: str) -> str:
        """Parse FTP date string to ISO format"""
        try:
            # Handle common FTP date formats
            if ':' in date_str:
                # Recent files with time: "Jan 15 14:30"
                dt = datetime.strptime(f"{datetime.now().year} {date_str}", "%Y %b %d %H:%M")
            else:
                # Older files with year: "Jan 15 2023"
                dt = datetime.strptime(date_str, "%b %d %Y")
            return dt.isoformat()
        except:
            return datetime.now().isoformat()
    
    def _get_file_type(self, filename: str) -> str:
        """Determine file type from extension"""
        ext = Path(filename).suffix.lower()
        type_map = {
            '.las': 'well_log',
            '.shp': 'shapefile',
            '.accdb': 'access_db',
            '.mdb': 'access_db',
            '.csv': 'data_table',
            '.xlsx': 'spreadsheet'
        }
        return type_map.get(ext, 'unknown')


class SFTPIngestionClient:
    """Client for ingesting data from SFTP servers"""
    
    def __init__(self, host: str, port: int = 22, username: str = None,
                 password: str = None, private_key_path: str = None,
                 credential_key: str = None):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.private_key_path = private_key_path
        self.credential_key = credential_key
        self.logger = logging.getLogger(__name__)
        
        # Initialize credentials if key provided
        if credential_key:
            cred_manager = CredentialManager()
            creds = cred_manager.get_credentials(credential_key)
            self.username = creds.get('username', username)
            self.password = creds.get('password', password)
            self.private_key_path = creds.get('private_key_path', private_key_path)
    
    def connect(self) -> paramiko.SFTPClient:
        """Establish SFTP connection"""
        try:
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            # Authentication methods
            if self.private_key_path and os.path.exists(self.private_key_path):
                # Key-based authentication
                ssh.connect(
                    hostname=self.host,
                    port=self.port,
                    username=self.username,
                    key_filename=self.private_key_path
                )
            elif self.username and self.password:
                # Password authentication
                ssh.connect(
                    hostname=self.host,
                    port=self.port,
                    username=self.username,
                    password=self.password
                )
            else:
                raise ValueError("No valid authentication method provided")
            
            sftp = ssh.open_sftp()
            self.logger.info(f"Connected to SFTP server: {self.host}")
            return sftp
        
        except Exception as e:
            self.logger.error(f"SFTP connection failed: {e}")
            raise
    
    def discover_files(self, remote_path: str = "/", 
                      file_patterns: List[str] = None) -> List[Dict]:
        """Discover files matching patterns on SFTP server"""
        if not file_patterns:
            file_patterns = [r'.*\.las$', r'.*\.shp$', r'.*\.accdb$', r'.*\.mdb$']
        
        discovered_files = []
        
        try:
            with self.connect() as sftp:
                discovered_files.extend(
                    self._recursive_sftp_search(sftp, remote_path, file_patterns)
                )
        except Exception as e:
            self.logger.error(f"SFTP file discovery failed: {e}")
        
        return discovered_files
    
    def _recursive_sftp_search(self, sftp: paramiko.SFTPClient, path: str,
                              patterns: List[str]) -> List[Dict]:
        """Recursively search SFTP directories"""
        files = []
        
        try:
            file_attrs = sftp.listdir_attr(path)
            
            for attr in file_attrs:
                full_path = f"{path.rstrip('/')}/{attr.filename}"
                
                if self._is_directory(sftp, full_path):
                    # Directory - recurse
                    files.extend(self._recursive_sftp_search(sftp, full_path, patterns))
                else:
                    # File - check patterns
                    for pattern in patterns:
                        if re.match(pattern, attr.filename, re.IGNORECASE):
                            files.append({
                                'remote_path': full_path,
                                'filename': attr.filename,
                                'size': attr.st_size or 0,
                                'modified': datetime.fromtimestamp(attr.st_mtime).isoformat() if attr.st_mtime else None,
                                'type': self._get_file_type(attr.filename)
                            })
                            break
                            
        except Exception as e:
            self.logger.warning(f"Error searching SFTP path {path}: {e}")
        
        return files
    
    def _is_directory(self, sftp: paramiko.SFTPClient, path: str) -> bool:
        """Check if path is a directory"""
        try:
            return sftp.stat(path).st_mode & 0o040000 != 0
        except:
            return False
    
    def download_files(self, files: List[Dict], local_directory: str) -> List[str]:
        """Download files via SFTP to local directory"""
        local_dir = Path(local_directory)
        local_dir.mkdir(parents=True, exist_ok=True)
        
        downloaded_files = []
        
        try:
            with self.connect() as sftp:
                for file_info in files:
                    remote_path = file_info['remote_path']
                    local_path = local_dir / file_info['filename']
                    
                    try:
                        sftp.get(remote_path, str(local_path))
                        downloaded_files.append(str(local_path))
                        self.logger.info(f"Downloaded: {remote_path} -> {local_path}")
                    
                    except Exception as e:
                        self.logger.error(f"Failed to download {remote_path}: {e}")
        
        except Exception as e:
            self.logger.error(f"SFTP download session failed: {e}")
        
        return downloaded_files
    
    def _get_file_type(self, filename: str) -> str:
        """Determine file type from extension"""
        ext = Path(filename).suffix.lower()
        type_map = {
            '.las': 'well_log',
            '.shp': 'shapefile', 
            '.accdb': 'access_db',
            '.mdb': 'access_db',
            '.csv': 'data_table',
            '.xlsx': 'spreadsheet'
        }
        return type_map.get(ext, 'unknown')


# Example usage and configuration
def create_ftp_client(config: Dict) -> FTPIngestionClient:
    """Factory function to create FTP client from config"""
    return FTPIngestionClient(
        host=config['host'],
        port=config.get('port', 21),
        username=config.get('username'),
        password=config.get('password'),
        credential_key=config.get('credential_key')
    )


def create_sftp_client(config: Dict) -> SFTPIngestionClient:
    """Factory function to create SFTP client from config"""
    return SFTPIngestionClient(
        host=config['host'],
        port=config.get('port', 22),
        username=config.get('username'),
        password=config.get('password'),
        private_key_path=config.get('private_key_path'),
        credential_key=config.get('credential_key')
    )