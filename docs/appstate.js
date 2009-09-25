/* appstate. js - application state objects-for handling complex display logic */


var new_base_resource = function () {

	// representation of the single point for updating alignment info, requesting sorted versions of the alignment, etc.
	// like a "main menu". Linked from the resources that actually contain alignment data.
	
	./* base resource works like this:
	
		/alignment/1/ -> contains list of links and forms
		
			<dl>
				<dd> base resource </dd> : <dt><a rel="baseresource" href="alignment/1/"></dt>
				<dd> tree </dd> : <dt><a rel="tree" href="alignment/1/tree"</dt>
				<dd> comments </dd> : <dt><a rel="comments" href="/alignment/1/comments/"</dt>
				<dd> alignment contents </dd> : <dt><a rel= "alignment-table" href="/alignment/1/table"></dt>
				etc.
			</dl>
			
			<!-- semantically identify form type with class attribute.
			   Note that we *could* go crazy adding indirection.
			   E.g., we could define a URI for GETing a column URI from a form, and then we could POST comments from the 
			   page at the column URI. I think this would be silly. Just form-encode the comment and the 
			   column/cell/row identifier -->
			
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
		/alignment/1/sorted
		
		This way, when the frontend wants to sort an alignment, it just needs to perform one request to get and display
		the sorted table; it would then send a second request to get the 
		
			
	*/	
}


// update this to reflect base_resource thinking above.

var new_alignment = function () {
	
	var that = {};
	
	tst.propertize(that);
	
	that.set("html", "");
	that.set("loaded", false);
	that.set("url", "");
	
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



