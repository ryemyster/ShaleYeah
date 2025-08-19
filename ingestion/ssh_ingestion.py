#!/usr/bin/env python3
"""
SSH/SCP Data Ingestion Client

Provides SSH command execution and SCP file transfer capabilities for accessing
remote geological databases and file systems. Supports key-based and password authentication.
"""

import os
import logging
import paramiko
import subprocess
from pathlib import Path
from typing import List, Dict, Optional, Tuple
import re
import json

from .credential_manager import CredentialManager


class SSHIngestionClient:
    """SSH client for remote command execution and database access"""
    
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
    
    def connect(self) -> paramiko.SSHClient:
        """Establish SSH connection"""
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
                    key_filename=self.private_key_path,
                    timeout=30
                )
            elif self.username and self.password:
                # Password authentication
                ssh.connect(
                    hostname=self.host,
                    port=self.port,
                    username=self.username,
                    password=self.password,
                    timeout=30
                )
            else:
                raise ValueError("No valid authentication method provided")
            
            self.logger.info(f"SSH connected to: {self.host}")
            return ssh
        
        except Exception as e:
            self.logger.error(f"SSH connection failed: {e}")
            raise
    
    def execute_command(self, command: str) -> Tuple[str, str, int]:
        """Execute command on remote system"""
        try:
            with self.connect() as ssh:
                stdin, stdout, stderr = ssh.exec_command(command)
                
                # Wait for command completion
                exit_status = stdout.channel.recv_exit_status()
                
                # Read output
                stdout_data = stdout.read().decode('utf-8')
                stderr_data = stderr.read().decode('utf-8')
                
                self.logger.info(f"Command executed: {command} (exit: {exit_status})")
                return stdout_data, stderr_data, exit_status
        
        except Exception as e:
            self.logger.error(f"Command execution failed: {e}")
            return "", str(e), -1
    
    def discover_database_files(self, search_paths: List[str] = None) -> List[Dict]:
        """Discover database files on remote system"""
        if not search_paths:
            search_paths = ['/home', '/data', '/opt', '/var/lib']
        
        discovered_files = []
        
        # Build find command for database files
        patterns = [
            "*.mdb", "*.accdb",           # Access databases
            "*.sqlite", "*.db",           # SQLite databases  
            "*.las", "*.LAS",             # Well logs
            "*.shp", "*.SHP",             # Shapefiles
            "*.csv", "*.xlsx"             # Data files
        ]
        
        for path in search_paths:
            for pattern in patterns:
                command = f"find {path} -name '{pattern}' -type f 2>/dev/null | head -100"
                stdout, stderr, exit_code = self.execute_command(command)
                
                if exit_code == 0 and stdout.strip():
                    for file_path in stdout.strip().split('\n'):
                        if file_path:
                            # Get file stats
                            stat_cmd = f"stat -c '%s %Y %n' '{file_path}' 2>/dev/null"
                            stat_out, _, stat_exit = self.execute_command(stat_cmd)
                            
                            if stat_exit == 0:
                                parts = stat_out.strip().split(' ', 2)
                                if len(parts) >= 3:
                                    size = int(parts[0])
                                    mtime = int(parts[1])
                                    filename = os.path.basename(file_path)
                                    
                                    discovered_files.append({
                                        'remote_path': file_path,
                                        'filename': filename,
                                        'size': size,
                                        'modified': mtime,
                                        'type': self._get_file_type(filename)
                                    })
        
        self.logger.info(f"Discovered {len(discovered_files)} database files")
        return discovered_files
    
    def query_database(self, db_path: str, query: str, db_type: str = 'sqlite') -> Dict:
        """Execute database query on remote system"""
        try:
            if db_type.lower() == 'sqlite':
                command = f"sqlite3 -json '{db_path}' \"{query}\""
            elif db_type.lower() == 'postgresql':
                command = f"psql -d '{db_path}' -c \"{query}\" --json"
            elif db_type.lower() == 'mysql':
                command = f"mysql -e \"{query}\" --json"
            else:
                raise ValueError(f"Unsupported database type: {db_type}")
            
            stdout, stderr, exit_code = self.execute_command(command)
            
            if exit_code != 0:
                raise Exception(f"Query failed: {stderr}")
            
            # Parse JSON output
            try:
                result = json.loads(stdout)
                return {'success': True, 'data': result}
            except json.JSONDecodeError:
                # Return raw output if not JSON
                return {'success': True, 'raw_output': stdout}
        
        except Exception as e:
            self.logger.error(f"Database query failed: {e}")
            return {'success': False, 'error': str(e)}
    
    def export_database_table(self, db_path: str, table_name: str, 
                             output_format: str = 'csv') -> str:
        """Export database table to file"""
        remote_output = f"/tmp/shale_export_{table_name}.{output_format}"
        
        try:
            if output_format == 'csv':
                command = f"sqlite3 -header -csv '{db_path}' 'SELECT * FROM {table_name}' > '{remote_output}'"
            elif output_format == 'json':
                command = f"sqlite3 -json '{db_path}' 'SELECT * FROM {table_name}' > '{remote_output}'"
            else:
                raise ValueError(f"Unsupported output format: {output_format}")
            
            stdout, stderr, exit_code = self.execute_command(command)
            
            if exit_code != 0:
                raise Exception(f"Export failed: {stderr}")
            
            return remote_output
        
        except Exception as e:
            self.logger.error(f"Database export failed: {e}")
            return None
    
    def _get_file_type(self, filename: str) -> str:
        """Determine file type from extension"""
        ext = Path(filename).suffix.lower()
        type_map = {
            '.mdb': 'access_db',
            '.accdb': 'access_db',
            '.sqlite': 'sqlite_db',
            '.db': 'database',
            '.las': 'well_log',
            '.shp': 'shapefile',
            '.csv': 'data_table',
            '.xlsx': 'spreadsheet'
        }
        return type_map.get(ext, 'unknown')


class SCPIngestionClient:
    """SCP client for efficient file transfer"""
    
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
        """Establish connection for SCP operations"""
        try:
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            # Authentication
            if self.private_key_path and os.path.exists(self.private_key_path):
                ssh.connect(
                    hostname=self.host,
                    port=self.port,
                    username=self.username,
                    key_filename=self.private_key_path
                )
            elif self.username and self.password:
                ssh.connect(
                    hostname=self.host,
                    port=self.port,
                    username=self.username,
                    password=self.password
                )
            else:
                raise ValueError("No valid authentication method provided")
            
            return ssh.open_sftp()
        
        except Exception as e:
            self.logger.error(f"SCP connection failed: {e}")
            raise
    
    def download_files(self, files: List[Dict], local_directory: str,
                      preserve_structure: bool = True) -> List[str]:
        """Download files via SCP"""
        local_dir = Path(local_directory)
        local_dir.mkdir(parents=True, exist_ok=True)
        
        downloaded_files = []
        
        try:
            with self.connect() as sftp:
                for file_info in files:
                    remote_path = file_info['remote_path']
                    
                    if preserve_structure:
                        # Preserve directory structure
                        rel_path = Path(remote_path).relative_to('/')
                        local_path = local_dir / rel_path
                        local_path.parent.mkdir(parents=True, exist_ok=True)
                    else:
                        # Flat structure
                        local_path = local_dir / file_info['filename']
                    
                    try:
                        sftp.get(remote_path, str(local_path))
                        downloaded_files.append(str(local_path))
                        self.logger.info(f"Downloaded: {remote_path} -> {local_path}")
                    
                    except Exception as e:
                        self.logger.error(f"Failed to download {remote_path}: {e}")
        
        except Exception as e:
            self.logger.error(f"SCP download session failed: {e}")
        
        return downloaded_files
    
    def upload_files(self, local_files: List[str], remote_directory: str) -> List[str]:
        """Upload files via SCP"""
        uploaded_files = []
        
        try:
            with self.connect() as sftp:
                # Ensure remote directory exists
                try:
                    sftp.mkdir(remote_directory)
                except IOError:
                    pass  # Directory may already exist
                
                for local_path in local_files:
                    if not os.path.exists(local_path):
                        continue
                    
                    filename = os.path.basename(local_path)
                    remote_path = f"{remote_directory.rstrip('/')}/{filename}"
                    
                    try:
                        sftp.put(local_path, remote_path)
                        uploaded_files.append(remote_path)
                        self.logger.info(f"Uploaded: {local_path} -> {remote_path}")
                    
                    except Exception as e:
                        self.logger.error(f"Failed to upload {local_path}: {e}")
        
        except Exception as e:
            self.logger.error(f"SCP upload session failed: {e}")
        
        return uploaded_files
    
    def sync_directory(self, remote_path: str, local_path: str,
                      direction: str = 'download') -> bool:
        """Synchronize directory contents"""
        try:
            if direction == 'download':
                return self._sync_download(remote_path, local_path)
            elif direction == 'upload':
                return self._sync_upload(local_path, remote_path)
            else:
                raise ValueError("Direction must be 'download' or 'upload'")
        
        except Exception as e:
            self.logger.error(f"Directory sync failed: {e}")
            return False
    
    def _sync_download(self, remote_path: str, local_path: str) -> bool:
        """Sync remote directory to local"""
        local_dir = Path(local_path)
        local_dir.mkdir(parents=True, exist_ok=True)
        
        try:
            with self.connect() as sftp:
                self._recursive_download(sftp, remote_path, local_dir)
            return True
        except Exception as e:
            self.logger.error(f"Recursive download failed: {e}")
            return False
    
    def _recursive_download(self, sftp: paramiko.SFTPClient, 
                           remote_path: str, local_path: Path):
        """Recursively download directory contents"""
        try:
            file_attrs = sftp.listdir_attr(remote_path)
            
            for attr in file_attrs:
                remote_file = f"{remote_path.rstrip('/')}/{attr.filename}"
                local_file = local_path / attr.filename
                
                if self._is_directory(sftp, remote_file):
                    local_file.mkdir(exist_ok=True)
                    self._recursive_download(sftp, remote_file, local_file)
                else:
                    sftp.get(remote_file, str(local_file))
                    self.logger.debug(f"Downloaded: {remote_file}")
        
        except Exception as e:
            self.logger.warning(f"Error in recursive download: {e}")
    
    def _is_directory(self, sftp: paramiko.SFTPClient, path: str) -> bool:
        """Check if path is directory"""
        try:
            return sftp.stat(path).st_mode & 0o040000 != 0
        except:
            return False
    
    def _sync_upload(self, local_path: str, remote_path: str) -> bool:
        """Sync local directory to remote"""
        if not os.path.exists(local_path):
            return False
        
        try:
            with self.connect() as sftp:
                self._recursive_upload(sftp, local_path, remote_path)
            return True
        except Exception as e:
            self.logger.error(f"Recursive upload failed: {e}")
            return False
    
    def _recursive_upload(self, sftp: paramiko.SFTPClient,
                         local_path: str, remote_path: str):
        """Recursively upload directory contents"""
        try:
            # Ensure remote directory exists
            try:
                sftp.mkdir(remote_path)
            except IOError:
                pass
            
            for item in os.listdir(local_path):
                local_item = os.path.join(local_path, item)
                remote_item = f"{remote_path.rstrip('/')}/{item}"
                
                if os.path.isdir(local_item):
                    self._recursive_upload(sftp, local_item, remote_item)
                else:
                    sftp.put(local_item, remote_item)
                    self.logger.debug(f"Uploaded: {local_item}")
        
        except Exception as e:
            self.logger.warning(f"Error in recursive upload: {e}")


# Factory functions
def create_ssh_client(config: Dict) -> SSHIngestionClient:
    """Create SSH client from configuration"""
    return SSHIngestionClient(
        host=config['host'],
        port=config.get('port', 22),
        username=config.get('username'),
        password=config.get('password'),
        private_key_path=config.get('private_key_path'),
        credential_key=config.get('credential_key')
    )


def create_scp_client(config: Dict) -> SCPIngestionClient:
    """Create SCP client from configuration"""
    return SCPIngestionClient(
        host=config['host'],
        port=config.get('port', 22),
        username=config.get('username'),
        password=config.get('password'),
        private_key_path=config.get('private_key_path'),
        credential_key=config.get('credential_key')
    )