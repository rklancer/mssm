from django.conf.urls.defaults import *
from django.conf import settings

urlpatterns = patterns(settings.PROJECT_NAME + '.mssm.views',
	(r'^alignments/$','alignment_list'),
	(r'^alignment/(\d+)/$', 'alignment_detail'),
)
