var tstate = function () {
    //private stuff

    return {
        /* add_property_capability: mixin get, set, add_property and get_properties functionality */

        add_property_manager: function (obj) {
            // private store for properties goes here
            var props = {};

            obj.get_properties = function () {
                ;
            }

            obj.get = function (prop) {
                ;
            }

            // return a protected "property manager" object that the client can keep secret
            mgr.set = function (prop, val) {
                if (typeof val === "object" 
                    && val.hasOwnProperty(get_properties) 
                    && typeof val.get_properties === "function") {
                    
                    // walk tree; register properties of val under those of obj
                }
            }

            mgr.add = function () {
                // read the property list from that arguments array-like object

                // *** must handle lists, objects (w/default values), and long argument list transparently
            }

            // accepts a function that will be passed the value whenever tstate is called on to set property
            mgr.setter = function (prop, setfunc) {
                ;
            }

            // tells tstate to allow setting this property in the "default" way, ie., just by calling mgr.set
            // without calling the special setter function defined in
            mgr.settable = function (prop) {
                ;
            };
            
            return mgr;
        }
    };
}();


/* note usages:

        // tstate global must have add_property_capability method
        tstate.add_property_capability(that, secrets)

        // but tstate must itself be a function, which returns objects that have a val method:
        tstate("base.url").val()

        // moreover it must copy over methods from the objects it wraps, to allow this shorthand:
        tstate("groups_def").set_source("url", grplink.attr("href"));    // *groups_def* defines set_source()!

        // furthermore, the objects must have some way to associate methods like seturl with the tstate
        // "set" method so that--for those properties which are relevant--the following can work:
        tstate("base.url").set( ... )       // not every property gets a "set" method
*/
