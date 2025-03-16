import argparse
import os
import json
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64

def generate_key():
    """Generate a new key and save it to keys.json"""
    key = Fernet.generate_key()
    key_str = base64.b64encode(key).decode('utf-8')
    with open('keys.json', 'w') as f:
        json.dump({'ENCRYPTION_KEY': key_str}, f, indent=4)
    print("New key generated and saved to keys.json")
    return key

def load_key():
    """Load encryption key from keys.json file"""
    try:
        with open('crypt/keys.json', 'r') as f:
            keys = json.load(f)
            key_str = keys.get('ENCRYPTION_KEY')
            if not key_str:
                return generate_key()
            return base64.b64decode(key_str)
    except FileNotFoundError:
        return generate_key()

def decrypt_file(input_file: str = 'age.env', output_file: str = 'new.env'):
    """Decrypt a file using Fernet symmetric encryption"""
    key = load_key()
    f = Fernet(key)
    
    with open(input_file, 'rb') as file:
        encrypted_data = file.read()
    
    decrypted_data = f.decrypt(encrypted_data)
    
    with open(output_file, 'wb') as file:
        file.write(decrypted_data)

def encrypt_file(input_file: str = '.env', output_file: str = 'age.env'):
    """Encrypt a file using Fernet symmetric encryption"""
    key = load_key()
    f = Fernet(key)
    
    with open(input_file, 'rb') as file:
        file_data = file.read()
    
    encrypted_data = f.encrypt(file_data)
    
    with open(output_file, 'wb') as file:
        file.write(encrypted_data)

def decrypt_files(input_file: str = 'age.env'):
    """Decrypt multiple files from a single encrypted file into the crypt folder"""
    key = load_key()
    f = Fernet(key)
    
    with open(input_file, 'rb') as file:
        encrypted_data = file.read()
    
    # Decrypt and parse the JSON data
    decrypted_data = f.decrypt(encrypted_data)

    files_data = json.loads(decrypted_data.decode('utf-8'))
    
    # Create crypt directory if it doesn't exist
    os.makedirs('crypt/output', exist_ok=True)
    
    # Write each file to the crypt folder with category prefix
    for categorized_path, content in files_data.items():
        # Split the category and original path
        category, original_path = categorized_path.split(':', 1) if ':' in categorized_path else ('backend', categorized_path)
        
        # Get just the filename without the path
        original_filename = os.path.basename(original_path)
        # Create new path in crypt folder with category prefix
        new_path = os.path.join('crypt/output', f'{category}_{original_filename}')
        
        with open(new_path, 'wb') as file:
            file.write(base64.b64decode(content))
        print(f"Decrypted {original_path} ({category}) to {new_path}")

def encrypt_files(input_files: list[str], output_file: str = 'age.env'):
    """Encrypt multiple files into a single encrypted file"""
    key = load_key()
    f = Fernet(key)
    
    # Create a dictionary to store file paths and their contents
    files_data = {}
    for input_file in input_files:
        # Determine the category based on the file path
        if '/app/' in input_file:
            category = 'app'
        elif '/web/' in input_file:
            category = 'web'
        else:
            category = 'backend'
            
        # Create a categorized key for the file
        categorized_path = f"{category}:{input_file}"
        
        with open(input_file, 'rb') as file:
            files_data[categorized_path] = base64.b64encode(file.read()).decode('utf-8')
    
    # Convert the dictionary to JSON and encrypt it
    json_data = json.dumps(files_data).encode('utf-8')
    encrypted_data = f.encrypt(json_data)
    
    with open(output_file, 'wb') as file:
        file.write(encrypted_data)

def main():
    parser = argparse.ArgumentParser(description='Encrypt/Decrypt files using cryptography')
    parser.add_argument('files', nargs='*', 
                        default=['.env', 
                                 'firebase/firebase_credentials.json',
                                  '../frontend/app/android/app/google-services.json',
                                 '../frontend/web/churchlink/.env'
                                 ],


                        help='Input files to process (for encryption) or encrypted file (for decryption). '
                             'Defaults to .env and firebase/firebase_credentials.json for encryption')
    parser.add_argument('-o', '--output', 
                        help='Output file path (default: age.env for encrypt, new.env for decrypt)')
    parser.add_argument('-e', '--encrypt', action='store_true', 
                        help='Encrypt instead of decrypt (default: decrypt)')
    parser.add_argument('-g', '--generate', action='store_true',
                        help='Generate a new encryption key')
    
    args = parser.parse_args()
    
    try:
        if args.generate:
            generate_key()
            return

        if args.encrypt:
            output_file = args.output or 'crypt/age.env'
            encrypt_files(args.files, output_file)
            print(f"Successfully encrypted {len(args.files)} files to {output_file}")
        else:
            input_file = 'crypt/age.env'
            decrypt_files(input_file)
            print(f"Successfully decrypted files from {input_file}")
    except Exception as e:
        print(f"Error processing files: {e}")

if __name__ == "__main__":
    main()
