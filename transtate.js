var tst = function () {
	//private stuff
	
	return {
		/* propertize: mixin get, set, and get_props() functionality */
		
		propertize: function (that, proplist) {
			// private store for properties goes here
			var props = proplist.slice();
			
			that.getprops = function () {
				;
			}
			
			that.get = function (prop) {
				;
			}
			
			// setter function is private
			return function (prop, val) {
				;
			}	
		}
	};
}();
