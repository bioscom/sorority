from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('profiles', '0018_alter_profile_slug'),
    ]

    operations = [
        migrations.AddField(
            model_name='profile',
            name='country',
            field=models.CharField(blank=True, default='', help_text="User's country of residence.", max_length=100, verbose_name='country'),
        ),
        migrations.AddField(
            model_name='profile',
            name='state_province',
            field=models.CharField(blank=True, default='', help_text="User's state or province of residence.", max_length=100, verbose_name='state or province'),
        ),
    ]
