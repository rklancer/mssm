/* appstate.js - application state objects-for handling complex display logic */


/*

    base_resource
        url
        loaded

        seturl()
    
    tree
        data
        loaded
        url

        seturl()
    
    seqtable
        loaded
        html
        
        coldata()
        rowdata()
        celldata()
        
        colname()
        rowname()
        cellname()
    
    groupsdef

        source: tree, sortcols, sortid
        
        set_threshold_service(url, param)
        set_from_threshold(t)
        set_from_server(url)

        OK: if source == tree, then groupsdef needs to told a function from threshold to grouping
        
            if source == sortcols, groupsdef needs to be told a url
            
            if source == sortid, groupsdef needs to be told a url
        
    refcols
        cols
        dosort()
        
    refrow
    
    opts
        property_highlight

*/

    

var new_base_resource = function (state) {

	// Representation of the single point for updating alignment info, requesting sorted versions
	// Like a "main menu". Linked from the resources that actually contain alignment data.
	
	./* base resource works like this:
	
		/alignment/1/ -> contains list of links and forms
		
			<dl>
				<dd> base resource </dd> : <dt><a rel="baseresource" href="alignment/1/"></dt>
				<dd> tree </dd> : <dt><a rel="tree" href="alignment/1/tree"</dt>
				<dd> comments </dd> : <dt><a rel="comments" href="/alignment/1/comments/"</dt>
				<dd> alignment contents </dd> : <dt><a rel= "alignment-table" href="/alignment/1/table"></dt>
				etc.
			</dl>
			
			<!-- semantically identify form type with class attribute. Note that we *could* go crazy adding
                 indirection. E.g., we could define a URI for GETing a column URI from a form, and then we
                 could POST comments from the page at the column URI. I think this would be silly. Just
                 form-encode the comment and the column/cell/row identifier -->
			
			<form class="commentform" action=/alignment/1/comments" method="POST">...</form> 
			<!-- redirect to comment resource, which includes 1. link to whole mapping 2. new hash-->
			etc.
		
		/alignment/1/table should contain
			
			1. a link to /alignment/1/
			2. a form for requesting a sorted alignment (semantically identified with class, as above)
			3. the table containing the function alignment
			4. a link to the grouping definition
			
		so after sorting you would have
		
			a *base resource* at /alignment/1/sorted/c17
		
		NOTE a sort request to the alignment *table* resource /alignment/1/table?sortBy=c17 would redirect to 
		/aligment/1/sorted/c17/table . This latter representation would contain a link to the base resource, 
		/alignment/1/sorted/c17/
		
		This way, when the frontend wants to sort an alignment, it just needs to perform one request to get 
        and display the sorted table; it could then send a second request to get the new representation at the
        base URL (i.e., /alignment/1/sorted/c17/, which contains a reference to /alignment/1/sorted/c17/table)
        What gets stored in the browser history is URL of the base resource for the sorted alignment.
        This base resource will point to all the subsidiary resources the app needs to go and get in order to
        display the sorted alignment correctly.
		
			
	*/

	var that = {};
	// probably want to include defaults
	var set = tst.propertize(that, ["url", "loaded", "error", "html"]);
	
	// when the object is not loaded, these provide a hook to the ongoing request, if any
	var requested_url, request_xhr;
	set("loaded", false);

	var error_callback = function (requrl, errxhr, status, err) {

	    if (errxhr !== request_xhr) {
	        // never mind..
	        return; 
	    }
	    request_xhr = null;
	    
	    // how to set automatic retry with limit?
	    	    
	    set("error", ...);          // let the ui know to do something
	    console.log(...)            // and log it.
	}
	
	// unclear if you want to process x(ht)ml response, or just as html
	var seturl_callback = function (requrl, html, status) {
	    
	    // ignore a callback for a different url (assuming we can't rely on xhr.abort() always working?)
	    if (requrl !== requested_url) {
	        return;
	    }

	    set("html", html);              // is this really necessary?
	    set("url", url);
	    
	    
	    var base = $(html);
	    
	    state.tree.seturl($("a[rel='tree']", base).attr("href"));
        state.seqtable.seturl("a[rel='seqtable']", base).attr("href"));
        
        /* If the server provides a *link* to a groupsdef, that means it has determined the grouping to use,
           and we should pass the url to the groupsdef object. If the server provides a *form* (with class
           "groupsdef-req"), the server is providing a facility for requesting a groupsdef based on some
           parameter(s) -- so pass the form along to the groupsdef object. */
        
        var grplink = $("a[rel='groupsdef']", base);
        if (grplink) {
            state.groupsdef.seturl(grplink.attr("href"));
        }
        else {
            state.groupsdef.setreqform(grplink.attr("form.groupsdef-req"));
        }
	    set("loaded", true);
	}

	that.seturl = function (newurl) {
	    var doxhr = function() {
            // turn caching off?

	        request_xhr = $.ajax({
    			url: newurl,
    			success: function (html, status) {
    			    success_callback(newurl, html, status);
    			},
    			error: function (xhr, status, err) {
    			    error_callback(newurl, errxhr, status, err);
    			}
    		});
    		set("loaded", false);
	    };
	    
	    if (get("loaded")) {
	        if (newurl !== get("url")) {
	            // a base resource is loaded, but the request is for a base resource at a different url
	            doxhr();
	        }
	    }
	    else if (!request_xhr) {
            // base resource is not loaded AND there is no outstanding xhr request
            doxhr();
        }
        else if (newurl !== request_url) {
            // base resource is not loaded, there is an outstanding xhr request, BUT it's for a different url
            request_xhr.abort();
            doxhr();
        }
	}
}

keep track of





// update this to reflect base_resource thinking above.

var new_seqtable = function () {
	
	var that = {};
	
	tst.propertize(that);
	
	that.set("html", "");
	that.set("loaded", false);
	that.set("url", "");
	
	that.seturl = function (url) {
	    if (url !== that.get("url")) {
    		$.ajax({
    			url: url,
    			success: seturl_callback(html, status),
    			error: error_callback(xhr, status, err)
    		});
    	}
	}
	
	var seturl_callback = function(url) {
	    set("url", url);
	}
	
	
	
	
	
	var success_callback = function (html) {
		that.set("html", html);
		that.set("loaded", true);
	}
	
	var ajaxload = function (url) {
		$.ajax({
			url: url,
			success: success_callback(html),
			error: error_callback(html),
		});
		that.set("loaded", false);
		that.set("html", null);
	}
	
	that.sort = function () {
		// fill in form
		
		ajaxload(url);
	}
	
	that.seturl = function (url) {
		ajaxload(url);
	}
	
	that.getcol
	
	that.getcolname
	
	that.getrow
	
	that.getrowname
	
	that.getcell
	
	that.getcellname
	
	return that;
}


var new_sort_cols = function () {
	
	var that = {};
	tst.propertize(that);
	
	that.set("cols", []);
	
	var add = function (cols, col, idx) {
		var newcols = cols.slice(0, idx);
		newcols.push(col);
		newcols.concat(cols.slice(idx, cols.length));
		
		return newcols;
	}
	
	var remove = function (cols, idx) {
		var newcols = cols.slice(0,idx);
		newcols.concat(cols.slice(idx+1, cols.length));
		
		return newcols;
	}
	
	that.add = function (col, idx) {
		if (idx > array.length) {
			console.log("sort_cols.addcol: idx > array.length");
			return;
		}
		that.set("cols", add(that.get("cols"), col, idx));
	}
	
	that.remove = function (idx) {
		if (idx >= array.length) {
			console.log("sort_cols.removecol: idx >= array.length");
			return;
		}
		that.set("cols", remove(that.get("cols"), idx));
	}
	
	that.move = function (oldidx, newidx) {
		// doing this "the lazy way" (via add then remove) shouldn't affect performance in any meaningful way

		var cols = that.get("cols");
		var col = cols[oldidx];

		cols = remove(cols, oldidx);
		if (oldidx < newidx) {
			//account for shift of indexes caused by removing 
			cols = add(cols, col, newidx-1);
		}
		else {
			cols = add(cols, col, newidx);
		}
		
		that.set("cols", cols);
	}
	
	that.removeall = function () {
		that.set("cols", []);
	}
	
	that.aslist = function () {
		// return a list suitable for use in form-encoded GET to server
	}

	return that;
}

var ref_row = function () {
	
}

var tree = function () {
	
	var that = {};
	
	tst.propertize(that);
	
	that.set("data", {});
	
	
	
	
	
}

var groups_def = function () {
}



