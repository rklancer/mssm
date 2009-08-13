/* size_overflow_containers: call this to resize the overflow containers such that the content within them can always be scrolled to the very bottom 

  scheme is this:
  
  <div class="x-overflow-container">
    <div class="scolling-panel">
      <div class="scrolling-content">
        (content to be scrolled left/right)
      </div>
    </div>
  </div>
  
  This function resizes the x-scrolling-panel so that it is the width of the contained content plus the width of the container it's in.
  (Similarly, it resizes y-scrolling-panels such that they are the height of the content plus the container.)
  This ensures that the content can be scrolled from the point at which its top is equal to the container top to the point where the content's
  bottom is right at the container's top */
  
  
var size_overflow_containers = function () {

    // eventually want to re-verify these on window resize
    // (plus obviously we'll remove these hard-coded values)
    
    var max_width = 1920;
    var max_height = 1200;
    var content, panel;
    
    $(".y-overflow-container").each( function () {
        panel = $(this).children(".scrolling-panel");  //relevant scrolling-panel should be a direct child
        content = panel.find(".scrolling-content");    //content may be a descendant of the panel at any depth
        
        panel.height(max_height + content.height());
        $(this).height(max_height);
        
        panel.width(content.width());
        $(this).width(content.width());
    });
    
    $(".x-overflow-container").each( function () {
        panel = $(this).children(".scrolling-panel");
        content = panel.find(".scrolling-content");
        
        panel.height(content.height());
        $(this).height(content.height());
        
        panel.width(max_width + content.width());
        $(this).width(max_width);
    });
};

/* safely_size_overflow_containers():

  call size_overflow_containers, but make sure to do it while sequence-table is display: none
  because resizing any divs containing the large sequence-table is a very slow operation
  
  note that sequence_table.hide() has to be given enought time to complete before
  the containing divs can be resized, and again the divs must be given time to be resized
  before the sequence_table is shown again! (Or else resizing the divs gums up the Firefox works...) */
  

var safely_size_overflow_containers = function () {
    var time_step = 50;
    var sequence_table = $("#sequence-table");
    var table_parent = sequence_table.parent(".scrolling-content");
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


var timeout = function(t, f) {
     window.setTimeout(f, t);
};


$(document).ready(function() {
	$("#stats-panel").tabs();
	
    $("#moveup").click( function () {
        $("#sequence-content-panel .y-overflow-container").scrollTop(100);
    });
    
    $("#movedown").click( function () {
        $("#sequence-content-panel .y-overflow-container").scrollTop(0);
    });
    
    safely_size_overflow_containers();
});