from django.conf import settings
from django.contrib import admin

from models import Alignment, AlignmentRow

admin.site.register(Alignment)
admin.site.register(AlignmentRow)