from django.shortcuts import render_to_response
import os

def css(request, css_file_name):
    context = {}
    if css_file_name == 'noraseq.css':
        context = noraseq_viewer_context()
    
    return render_to_response(os.path.join('noraseq', css_file_name), context, mimetype="text/css")


def noraseq_viewer_context():
    return {}
