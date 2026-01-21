import os
import sys
import django
from pathlib import Path

# Setup Django
sys.path.insert(0, str(Path(__file__).parent))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import connection

print("Creating database tables...")

# Read SQL file
sql_file = Path(__file__).parent / 'create_tables.sql'
with open(sql_file, 'r') as f:
    sql_commands = f.read()

# Split by semicolon and execute each statement
with connection.cursor() as cursor:
    for statement in sql_commands.split(';'):
        statement = statement.strip()
        if statement:
            try:
                cursor.execute(statement)
                print(f"✓ Executed: {statement[:50]}...")
            except Exception as e:
                # Table might already exist
                if 'already exists' in str(e).lower():
                    print(f"⚠ Table already exists (skipping)")
                else:
                    print(f"✗ Error: {e}")

print("\n✅ Database setup complete!")
print("Starting Django server...")
