import os

path = '/opt/gsa-tv/cache/media/1/production/autonomous/tools/render-generic-program.py'
with open(path, 'r') as f:
    content = f.read()

# Replace exception handling in fetch_media
old_except = """        except Exception as e:
            print(f"Pexels error for '{query}': {e}")"""
new_except = """        except Exception as e:
            print(f"Pexels error for '{query}': {e}")
            with open('/tmp/pexels_errors.txt', 'a') as err_file:
                err_file.write(f"Pexels error for '{query}': {e}\\n")"""

content = content.replace(old_except, new_except)

with open(path, 'w') as f:
    f.write(content)
print('Patched exception handling.')
