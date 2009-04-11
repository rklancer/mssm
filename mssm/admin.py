from django.conf import settings
from django.contrib import admin

# the following line allows us to reference Alignment and AlignmentRow from the
# MSSM model without hardcoding the Django project name into an import statement

project_module = __import__(settings.PROJECT_NAME + '.mssm.models')

admin.site.register(project_module.mssm.models.Alignment)
admin.site.register(project_module.mssm.models.AlignmentRow)
