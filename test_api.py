import requests

try:
    response = requests.get('http://localhost:8000/api/profiles/public/?ordering=current_age', timeout=5)
    data = response.json()
    print(f'Status: {response.status_code}')
    print(f'Count: {data.get("count", "N/A")}')
    results = data.get('results', [])
    print(f'Results length: {len(results)}')
    if results:
        print('First profile:', results[0]['full_name'])
    else:
        print('No results')
except Exception as e:
    print(f'Error: {e}')