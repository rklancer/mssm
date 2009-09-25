/* transtate.js - a "transparent state" library for maintaining a list of application-state objects
  and performing actions based on changes to their state */

var tst = function () {
	//private stuff
	
	return {
		/* propertize: mixin get, set, and get_props() functionality */
		
		propertize: function (that) {
			// private store for properties goes here
			var ...
			
			that.getprops = function () {
				;
			}
			
			that.get = function (prop) {
				;
			}
			
			that.set = function (prop, val){
				;
			}	
		}
	};
}();


// example usage. Inconsistent and half-assedly specified, but this gives the idea.


$(document).ready(function () {

	tst.add('last_clicked', "");
	
	// 1. create the objects, and give them names under 'tst'
	
	tst.add('alignment', new_alignment());				// bind tst('alignment') to new alignment object
	
	
	// 2. for properties of those objects, bind history listeners, custom events, and so on
		
	tst('selected_items')
		.hist('sel', function (prop) { prop.serialize(); }, function (val) { this.set(v) } )
		.bind('col_click', function (col) { this.toggle(col) }
		.bind('col_ctlclick', ...);
		
	tst('last_clicked').bind('col_click', function (e) {this.set(e) });
	
	//etc.
}