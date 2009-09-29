var tst = function () {
    //private stuff
    
    return {
        /* add_property_capability: mixin get, set, add_property and get_properties functionality */
        
        add_property_capability: function (obj, secrets) {
            // private store for properties goes here
            var props = {};
            
            obj.get_properties = function () {
                ;
            }
            
            obj.get = function (prop) {
                ;
            }
            
            // segregate set and add_property to a secrets object that can be sequestered by the 
            // newly-propertized object.
            secrets.set = function (prop, val) {
                ;
            }   
            
            secrets.add_property = function () {
                // read the property list from that arguments array-like object
            }
        }
    };
}();
