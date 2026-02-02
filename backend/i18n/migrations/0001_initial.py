from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='TranslatedString',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('key', models.CharField(db_index=True, max_length=255)),
                ('source_text', models.TextField()),
                ('source_language', models.CharField(max_length=16)),
                ('target_language', models.CharField(db_index=True, max_length=16)),
                ('translated_text', models.TextField(blank=True)),
                ('provider', models.CharField(blank=True, max_length=64)),
                ('checksum', models.CharField(db_index=True, max_length=64)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('completed', 'Completed'), ('failed', 'Failed')], default='pending', max_length=16)),
                ('last_error', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'unique_together': {('key', 'target_language', 'checksum')},
            },
        ),
        migrations.AddIndex(
            model_name='translatedstring',
            index=models.Index(fields=['key', 'target_language', 'checksum'], name='i18n_trans_key_targ_7be127_idx'),
        ),
        migrations.AddIndex(
            model_name='translatedstring',
            index=models.Index(fields=['status', 'target_language'], name='i18n_trans_status__dbaa0e_idx'),
        ),
    ]
