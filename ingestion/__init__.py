#!/usr/bin/env python3
"""
SHALE YEAH Data Ingestion Module

Provides data ingestion capabilities for oil & gas data from various sources:
- FTP/SFTP servers with LAS files
- SSH/SCP remote geological databases  
- Microsoft shared folders with Access databases
- Network drives and file system crawling
- Automated pipeline triggers and monitoring

This module transforms SHALE YEAH from a demo system into a production
platform that ingests real oil & gas data from enterprise sources.
"""

from .ftp_ingestion import FTPIngestionClient, SFTPIngestionClient
from .ssh_ingestion import SSHIngestionClient, SCPIngestionClient
from .smb_ingestion import SMBIngestionClient, NetworkDriveClient
from .file_crawler import FileSystemCrawler, DataPipelineMonitor
from .credential_manager import CredentialManager
from .data_processor import DataProcessor, LASProcessor, AccessProcessor

__all__ = [
    'FTPIngestionClient',
    'SFTPIngestionClient', 
    'SSHIngestionClient',
    'SCPIngestionClient',
    'SMBIngestionClient',
    'NetworkDriveClient',
    'FileSystemCrawler',
    'DataPipelineMonitor',
    'CredentialManager',
    'DataProcessor',
    'LASProcessor',
    'AccessProcessor'
]