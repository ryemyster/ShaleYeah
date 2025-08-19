#!/usr/bin/env python3
"""
Credential Manager - Secure credential storage and retrieval

Provides secure credential management for data ingestion clients.
Supports environment variables, encrypted files, and external key vaults.
"""

import os
import json
import logging
from pathlib import Path
from typing import Dict, Optional
import base64
from cryptography.fernet import Fernet


class CredentialManager:
    """Secure credential manager for data ingestion"""
    
    def __init__(self, credentials_file: str = None, encryption_key: str = None):
        self.logger = logging.getLogger(__name__)
        self.credentials_file = credentials_file or self._get_default_credentials_file()
        self.encryption_key = encryption_key or os.getenv('SHALE_YEAH_ENCRYPTION_KEY')
        
        # Initialize encryption if key provided
        self.cipher = None
        if self.encryption_key:
            try:
                self.cipher = Fernet(self.encryption_key.encode() if len(self.encryption_key) == 44 else base64.urlsafe_b64encode(self.encryption_key.encode()[:32].ljust(32, b'\0')))
            except Exception as e:
                self.logger.warning(f"Failed to initialize encryption: {e}")
    
    def _get_default_credentials_file(self) -> str:
        """Get default credentials file path"""
        return str(Path.home() / '.shale-yeah' / 'credentials.json')
    
    def get_credentials(self, credential_key: str) -> Dict:
        """Retrieve credentials by key"""
        # First, try environment variables
        env_creds = self._get_from_environment(credential_key)
        if env_creds:
            return env_creds
        
        # Then try credentials file
        file_creds = self._get_from_file(credential_key)
        if file_creds:
            return file_creds
        
        # Finally, try external key vault (placeholder)
        vault_creds = self._get_from_vault(credential_key)
        if vault_creds:
            return vault_creds
        
        self.logger.warning(f"No credentials found for key: {credential_key}")
        return {}
    
    def _get_from_environment(self, credential_key: str) -> Dict:
        """Get credentials from environment variables"""
        env_prefix = f"SHALE_YEAH_{credential_key.upper()}_"
        
        credentials = {}
        for key, value in os.environ.items():
            if key.startswith(env_prefix):
                cred_name = key[len(env_prefix):].lower()
                credentials[cred_name] = value
        
        return credentials if credentials else None
    
    def _get_from_file(self, credential_key: str) -> Dict:
        """Get credentials from encrypted file"""
        if not os.path.exists(self.credentials_file):
            return None
        
        try:
            with open(self.credentials_file, 'r') as f:
                data = json.load(f)
            
            if credential_key not in data:
                return None
            
            cred_data = data[credential_key]
            
            # Decrypt if cipher available and data is encrypted
            if self.cipher and isinstance(cred_data, str) and cred_data.startswith('gAAAAA'):
                try:
                    decrypted_data = self.cipher.decrypt(cred_data.encode())
                    return json.loads(decrypted_data.decode())
                except Exception as e:
                    self.logger.error(f"Failed to decrypt credentials for {credential_key}: {e}")
                    return None
            
            return cred_data if isinstance(cred_data, dict) else None
            
        except Exception as e:
            self.logger.error(f"Failed to read credentials file: {e}")
            return None
    
    def _get_from_vault(self, credential_key: str) -> Dict:
        """Get credentials from external key vault (placeholder)"""
        # Placeholder for external key vault integration
        # Could integrate with:
        # - HashiCorp Vault
        # - AWS Secrets Manager
        # - Azure Key Vault
        # - Google Secret Manager
        return None
    
    def store_credentials(self, credential_key: str, credentials: Dict, encrypt: bool = True) -> bool:
        """Store credentials securely"""
        try:
            # Ensure credentials directory exists
            creds_dir = Path(self.credentials_file).parent
            creds_dir.mkdir(parents=True, exist_ok=True)
            
            # Load existing credentials
            existing_data = {}
            if os.path.exists(self.credentials_file):
                with open(self.credentials_file, 'r') as f:
                    existing_data = json.load(f)
            
            # Encrypt credentials if cipher available and encryption requested
            if encrypt and self.cipher:
                try:
                    json_data = json.dumps(credentials)
                    encrypted_data = self.cipher.encrypt(json_data.encode())
                    existing_data[credential_key] = encrypted_data.decode()
                except Exception as e:
                    self.logger.error(f"Encryption failed, storing unencrypted: {e}")
                    existing_data[credential_key] = credentials
            else:
                existing_data[credential_key] = credentials
            
            # Save updated credentials
            with open(self.credentials_file, 'w') as f:
                json.dump(existing_data, f, indent=2)
            
            # Set restrictive permissions
            os.chmod(self.credentials_file, 0o600)
            
            self.logger.info(f"Credentials stored for key: {credential_key}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to store credentials: {e}")
            return False
    
    def list_credential_keys(self) -> List[str]:
        """List available credential keys"""
        keys = []
        
        # From environment variables
        env_keys = set()
        for key in os.environ.keys():
            if key.startswith('SHALE_YEAH_') and '_' in key[11:]:
                env_key = key.split('_')[2]
                env_keys.add(env_key.lower())
        keys.extend(env_keys)
        
        # From credentials file
        if os.path.exists(self.credentials_file):
            try:
                with open(self.credentials_file, 'r') as f:
                    data = json.load(f)
                keys.extend(data.keys())
            except Exception as e:
                self.logger.error(f"Failed to read credentials file: {e}")
        
        return list(set(keys))  # Remove duplicates
    
    def delete_credentials(self, credential_key: str) -> bool:
        """Delete stored credentials"""
        if not os.path.exists(self.credentials_file):
            return False
        
        try:
            with open(self.credentials_file, 'r') as f:
                data = json.load(f)
            
            if credential_key in data:
                del data[credential_key]
                
                with open(self.credentials_file, 'w') as f:
                    json.dump(data, f, indent=2)
                
                self.logger.info(f"Credentials deleted for key: {credential_key}")
                return True
            
            return False
            
        except Exception as e:
            self.logger.error(f"Failed to delete credentials: {e}")
            return False
    
    @staticmethod
    def generate_encryption_key() -> str:
        """Generate a new encryption key"""
        return Fernet.generate_key().decode()


# Example configurations for common data sources
COMMON_CREDENTIAL_TEMPLATES = {
    'ftp_server': {
        'username': 'your_ftp_username',
        'password': 'your_ftp_password'
    },
    'sftp_server': {
        'username': 'your_ssh_username', 
        'password': 'your_ssh_password',
        'private_key_path': '/path/to/private/key'
    },
    'smb_share': {
        'username': 'DOMAIN\\username',
        'password': 'your_smb_password',
        'domain': 'DOMAIN'
    },
    'database': {
        'username': 'db_username',
        'password': 'db_password',
        'host': 'database.company.com',
        'port': '5432',
        'database': 'geology_db'
    }
}


def setup_credentials_interactive():
    """Interactive setup for credentials"""
    print("SHALE YEAH Credential Setup")
    print("=" * 30)
    
    cred_manager = CredentialManager()
    
    print("Available credential templates:")
    for i, (key, template) in enumerate(COMMON_CREDENTIAL_TEMPLATES.items(), 1):
        print(f"{i}. {key}")
    
    choice = input("\nSelect template (1-4) or 'custom': ").strip()
    
    if choice.isdigit() and 1 <= int(choice) <= len(COMMON_CREDENTIAL_TEMPLATES):
        template_key = list(COMMON_CREDENTIAL_TEMPLATES.keys())[int(choice) - 1]
        template = COMMON_CREDENTIAL_TEMPLATES[template_key]
    else:
        template = {}
    
    credential_key = input("Enter credential key name: ").strip()
    
    credentials = {}
    for field, example in template.items():
        value = input(f"Enter {field} ({example}): ").strip()
        if value:
            credentials[field] = value
    
    # Allow additional custom fields
    while True:
        custom_field = input("Add custom field (or press Enter to finish): ").strip()
        if not custom_field:
            break
        custom_value = input(f"Enter value for {custom_field}: ").strip()
        if custom_value:
            credentials[custom_field] = custom_value
    
    # Store credentials
    encrypt = input("Encrypt credentials? (y/N): ").strip().lower() == 'y'
    
    if cred_manager.store_credentials(credential_key, credentials, encrypt):
        print(f"✅ Credentials stored successfully for '{credential_key}'")
    else:
        print("❌ Failed to store credentials")


if __name__ == "__main__":
    setup_credentials_interactive()