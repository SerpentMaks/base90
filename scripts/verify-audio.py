"""Проверка готовых AAC-файлов; нужен ffprobe. Не анализирует качество произношения.
Повторный запуск проверяет новые/изменённые файлы, кэш метаданных хранится вне git.
"""
import concurrent.futures
import json
import pathlib
import subprocess
import tempfile

root = pathlib.Path(__file__).resolve().parents[1]
cache_path = pathlib.Path(tempfile.gettempdir()) / 'base90-audio-verified.json'
try:
    cache = json.loads(cache_path.read_text())
except (FileNotFoundError, ValueError):
    cache = {}
files = sorted((root / 'public/audio/af_heart').glob('*.m4a'))


def verify(path):
    stat = path.stat()
    signature = [stat.st_size, stat.st_mtime_ns]
    if cache.get(path.name, {}).get('signature') == signature:
        return path.name, cache[path.name], None
    result = subprocess.run(['ffprobe', '-v', 'error', '-show_entries',
        'format=duration:stream=codec_name,sample_rate,channels', '-of', 'json', str(path)],
        capture_output=True, text=True, timeout=15)
    try:
        data = json.loads(result.stdout)
        duration = float(data['format']['duration'])
        stream = data['streams'][0]
        valid = (not result.returncode and 0.2 <= duration <= 45
            and stream['codec_name'] == 'aac' and stream['sample_rate'] == '24000'
            and stream['channels'] == 1)
        if not valid:
            return path.name, None, f'неожиданный формат или длительность: {data}'
        return path.name, {'signature': signature, 'duration': duration}, None
    except (ValueError, KeyError, IndexError):
        return path.name, None, result.stderr[:200] or 'нечитаемый файл'


errors = []
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    for index, (name, metadata, error) in enumerate(pool.map(verify, files), 1):
        if error:
            errors.append(f'{name}: {error}')
        else:
            cache[name] = metadata
        if index % 500 == 0:
            print(f'  {index}/{len(files)}', flush=True)
cache_path.write_text(json.dumps(cache))
if errors:
    print('\n'.join(errors))
    raise SystemExit(1)
print(f'✓ {len(files)} AAC-файлов читаются; длительность 0,2–45 с, mono 24 кГц')
