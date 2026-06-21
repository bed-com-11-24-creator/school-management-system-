import re
import os

def convert_file(filename):
    filepath = os.path.join(os.getcwd(), filename)
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_size = len(content)
    
    # Replace PostgreSQL parameters $1-$8 with ?
    for i in range(8, 0, -1):
        content = content.replace(f'${i}', '?')
    
    # Replace rowCount checks with rows.length
    content = re.sub(r'(\w+Res?)\.rowCount', r'\1.rows.length', content)
    content = re.sub(r'result\.rowCount', r'result.rows.length', content)
    
    # Remove RETURNING clauses
    content = re.sub(r'\s+RETURNING\s+\*', '', content, flags=re.IGNORECASE)
    content = re.sub(r'\s+RETURNING\s+[^;]+(?=\s*[;`\'"]|$)', '', content, flags=re.IGNORECASE)
    
    # Replace ON CONFLICT...DO UPDATE with ON DUPLICATE KEY UPDATE
    content = re.sub(
        r'ON CONFLICT\s*\([^)]+\)\s+DO UPDATE SET', 
        'ON DUPLICATE KEY UPDATE',
        content,
        flags=re.IGNORECASE
    )
    
    # Remove ::type casts
    content = re.sub(r'::[a-zA-Z_\[\]]+', '', content)
    
    new_size = len(content)
    
    with open(filepath, 'w', encoding='utf-8') as file:
        file.write(content)
    
    return original_size, new_size

files = ['server.js', 'attendance-api.js', 'fees-api.js', 'subjects-api.js']
for f in files:
    try:
        orig, new = convert_file(f)
        print(f'✓ {f}: {orig} → {new} bytes')
    except Exception as e:
        print(f'✗ {f}: {e}')
