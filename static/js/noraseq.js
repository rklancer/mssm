$(document).ready(function() {
    $("#stats-panel").tabs();
    
    $("#moveup").click( function () {
        $("#sequence-content-panel .y-overflow-container").animate({scrollTop: 300}, 1000);
    });
    
    $("#movedown").click( function () {
        $("#sequence-content-panel .y-overflow-container").animate({scrollTop: 0}, 1000);
    });
    
    /* test speed of interactive responses to click event on table cells (uses event delegation to bind
        handler once, to #sequence-table.) */
        
    $("#sequence-table").mousedown( function (e) {
        var td = $(e.target).closest("td").not(".gap");        
        
        td.addClass("commented");
        
        /*
        if (td) {
            var done = function () {
                td.removeClass("commented").unbind('mouseleave.test-event-delegation')
                    .unbind('mouseup.test-event-delegation');
            };
            
            // use .test-event-delegation namespace for the events we bind so that later we unbind just the handler
            // below. Another option is for done() to pass to unbind() a reference to itself...
            
            td.addClass("commented").bind("mouseleave.test-event-delegation", done).bind("mouseup.test-event-delegation", done);
        }
        */
        
    });
    
    
    $("#sequence-table").mouseover( function (e) {
        var td = $(e.target).closest("td").not(".gap");
        
        td.addClass("hovered-cell").bind("mouseout.noraseq-hover", function () {
            td.removeClass("hovered-cell").unbind("mouseout.noraseq-hover");
        });                
    });
    
    
    
    $("#column-labels-table").mouseover( function (e) {
        var th = $(e.target).closest("th");
        var col_class_selector = "."+th.attr("className").match(/\b(c\d+)\b/)[1];
        var col = $(col_class_selector);
        
        col.addClass("hovered");
        th.bind("mouseout.noraseq-hover", function () {
            col.removeClass("hovered");
            th.unbind("mouseout.noraseq-hover");
        });
    });
    
    
    $("#column-labels-table").click( function (e) {
        var col_class_selector = "."+$(e.target).attr("className").match(/\b(c\d+)\b/)[1];
        var col = $(col_class_selector);
        
        if ($(e.target).hasClass("selected")) {
            col.removeClass("selected"); 
        }
        else {   
            col.addClass("selected"); 
        }
    });
        
    $("#row-label-panel").resizable({'helper': 'ui-state-highlight'});
    
    safely_size_overflow_containers();
});


/* safely_size_overflow_containers():

  Call size_overflow_containers(), but make sure to do it while #sequence-table is display: none because resizing any 
  divs containing the large sequence-table is a very slow operation in Firefox.
  
  Note that in order for this strategy to work, we need to pause between hiding #sequence-table and resizing any
  divs that contain it; similarly we need to pause to allow the div resizing to finish processing before we
  show #sequence-table again.
*/

var safely_size_overflow_containers = function () {
    var time_step = 50;
    var sequence_table = $("#sequence-table");
    var table_parent = sequence_table.closest(".scrolling-content");
    var table_height = sequence_table.height();
    var table_width = sequence_table.width();

    timeout(time_step, function () {
        sequence_table.hide();
        timeout(time_step, function () {
            table_parent.height(table_height).width(table_width);
            size_overflow_containers();
            timeout(time_step, function () {
                sequence_table.show();
            });
        });
    });
};


/* size_overflow_containers: 

  Call this to resize the overflow containers such that the content within them can always be scrolled
  to the very bottom (for .y-overflow-containers) or to the far right (for .x-overflow-containers.)

  scheme is this:
  
  <div class="x-overflow-container">
    <div class="scolling-panel">         <!-- must be immediate child of x-overflow-container) -->
      <div class="scrolling-content">      <!-- must be immediate child of scrolling-panel -->
        (content to be scrolled left/right)
      </div>
    </div>
  </div>
  
  This function assumes a maximum size for the .x-overflow-container (it's assumed to be no wider than the monitor
  size. Still need to write the mechanism that sets a larger maximum size if the viewport is ever enlarged larger
  than the monitor size.)
  
  Then it resizes the x-scrolling-panel so that it is the width of the contained content plus the width of the 
  .x-overflow-container it's in. (Similarly, it resizes y-scrolling-panels such that they are the height of the 
  content plus the container.)
  
  This ensures that the content can be scrolled up from the point at which the content left edge overlaps the left 
  edge of the overflow container, to the point at which the content's *right edge* overlaps the left edge of the 
  overflow container. (For y-scrolling case, substitute "top" for "left" and "bottom" for "right".)

  NOTE the size of the content to be scrolled should never change; this function examines the original height
  and width of the content and caches them before it modifies the .x(y)-overflow-container sizes; subsequent calls
  use the cached values. This is necessary because in the case of an x-overflow-container nested in a
  y-overflow-container, or vice versa, the function will modify the apparent height or width of the inner container
  making it impossible in general to know how to add up the dimensions of the content that is enclosed by the outer
  container, but not the inner, with the dimensions of the content that is enclosed by both containers. 
 
*/
  
  
var size_overflow_containers = function () {

    var orig_height, orig_width;
    var content, panel;

    // fixme:
    // eventually want to re-verify these on window resize
    // (plus obviously we'll remove these hard-coded values)
    
    var max_width = 1920;
    var max_height = 1200;

    
    $(".y-overflow-container, .x-overflow-container").each( function () {          
        panel = $(this).children(".scrolling-panel"); 
        content = panel.children(".scrolling-content");
        
        if (!content.data("orig_height")) {
            content.data("orig_height", content.height());
            content.data("orig_width", content.width());
        }
                
        orig_height = content.data("orig_height");
        orig_width = content.data("orig_width");        
        
        if ($(this).hasClass(".y-overflow-container")) {
            panel.height(max_height + orig_height);
            $(this).height(max_height);

            panel.width(orig_width);
            $(this).width(orig_width);
        } 
        else if ($(this).hasClass(".x-overflow-container")) {            
            panel.height(orig_height);
            $(this).height(orig_height);
        
            panel.width(max_width + orig_width);
            $(this).width(max_width);
        }
    });
};


var timeout = function(t, f) {
     window.setTimeout(f, t);
};

