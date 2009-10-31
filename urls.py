from django.conf.urls.defaults import *

urlpatterns = patterns('noraseq.views',
    (r'^$', 'index'),
    (r'^deleted/$', 'deleted'),
    (r'^alignments/$','alignment_list'),
    (r'^alignment/(\d+)/$', 'alignment_detail'),
    (r'^api/v1/', include('noraseq.api.urls'))
)
