from itertools import chain, izip
from django.template.loader import render_to_string


class PreRenderer(object):
    """
    Each Alignment has a Prerenderer object. Using Prerenderer significantly speeds up generation of the
    full alignment HTML for large alignments
    
    Before rendering a sequence of alignment rows to an html table, call
        pre = PreRenderer(template_path, alignment)
    
    This template should generate alignment.length tds, with '%s' substituted for the residue-dependent class
    attribute of each td, and '%c' as the contents of each td element.
    
    Subsequently, call pre.render_row(row.sequence) for each row. The return value is a string
    containing the <td> elements for each row, with the '%c's substituted with the individual characters from
    the row sequence, and the '%s's substituted with 'gap' if the residue is a gap and '' otherwise
    
    (Obviously, this is suboptimal from a code cleanliness perspective, but it really is much faster)
    """
    def __init__(self, template_path, alignment):
        self.template_string = render_to_string(
            template_path,
            { 'col_nums': xrange(1, alignment.length+1) }
        )

    def render_row(self, seq):
        # note that chain(*izip...) is a formula for splicing two iterables together like so:
        #     iter(['gap', '', 'gap', ...]) + iter(['-', 'A', '-',...])
        #         -> iter(['gap', '-', '', 'A', 'gap', '-',...])

        return self.template_string % tuple(
            chain(*izip(('gap' if c=='-' else '' for c in seq), seq))
        )  