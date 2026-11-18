import os
import sqlite3
from contextlib import closing
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone


RETENTION_COUNT = 7
BACKUP_PREFIX = 'store-manager-'


class Command(BaseCommand):
    help = 'Create a consistent SQLite backup in the configured cloud-mounted directory.'

    def handle(self, *args, **options):
        destination_value = settings.SQLITE_BACKUP_DIR
        if not destination_value:
            raise CommandError('Set SQLITE_BACKUP_DIR to the cloud backup directory.')

        database_name = settings.DATABASES['default']['NAME']
        database_path = Path(database_name).resolve()
        project_root = settings.BASE_DIR.parent.resolve()
        destination_dir = Path(destination_value).expanduser().resolve()
        if project_root == destination_dir or project_root in destination_dir.parents:
            raise CommandError('The backup directory must be outside the project directory.')
        if not database_path.is_file():
            raise CommandError(f'SQLite database was not found: {database_path}')

        destination_dir.mkdir(parents=True, exist_ok=True)
        timestamp = timezone.localtime(timezone.now()).strftime('%Y%m%d-%H%M%S')
        destination_path = destination_dir / f'{BACKUP_PREFIX}{timestamp}.sqlite3'
        temporary_path = destination_dir / f'{destination_path.name}.tmp'

        try:
            with closing(sqlite3.connect(database_path)) as source, closing(
                sqlite3.connect(temporary_path),
            ) as target:
                source.backup(target)
                integrity = target.execute('PRAGMA integrity_check').fetchone()[0]
                if integrity != 'ok':
                    raise CommandError(f'Backup integrity check failed: {integrity}')
                target.commit()
            os.replace(temporary_path, destination_path)
        finally:
            if temporary_path.exists():
                temporary_path.unlink()

        backups = sorted(
            destination_dir.glob(f'{BACKUP_PREFIX}*.sqlite3'),
            key=lambda path: path.name,
            reverse=True,
        )
        for old_backup in backups[RETENTION_COUNT:]:
            old_backup.unlink()

        self.stdout.write(self.style.SUCCESS(f'Created SQLite backup: {destination_path}'))
