from django.conf import settings
from django.contrib import admin

# the following dynamically imports Alignment and AlignmentRow
# without hardcoding the Django project name

MODELS = settings.PROJECT_NAME + '.mssm.models'
project_module = __import__(MODELS)
Alignment = project_module.mssm.models.Alignment
AlignmentRow = project_module.mssm.models.AlignmentRow

# now register the models...

admin.site.register(Alignment)
admin.site.register(AlignmentRow)
