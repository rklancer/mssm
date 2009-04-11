from django.conf.urls.defaults import *

urlpatterns = patterns('mysite.mssm.views',
	(r'^alignments/$','alignment_list'),
	(r'^alignment/(\d+)/$', 'alignment_detail'),
)
