var tstate = function (selector) {

    var prop_val = parse_selector_and_get_value(selector);
    var ret_obj;
    
    
    methods_to_add = {
        val: function () {
            return prop_val;
        },
        
        on_change: function (action) {
        }
    };    
    
    
    if (is_object(prop_val)) {
        
        for (item in prop_val) {
            if (prop_val.hasOwnProperty(item) 
                && typeof(item) === "function" 
                && !methods_to_add.hasOwnProperty(item)) {
            
                ret_obj[item] = prop_val[item];
            
            }
        }
    }
    else {
        ret_obj = {};
        
        return propval;
        
    }
    
    
    ret_obj.on_change = function () {
    }
    
    ret_obj.val = function () {
        return propval;
    };
    
    
    return ret_obj;
    
    
    // add methods:
    // val, on_change
    
    // consider: tstate("tree").set_instance_url
    //  --> results in call to (tree-propmgr).set("instance", new_tree_instance(url))
    //  --> must be observed by tstate selector mechanism
    
    

};



/* add_property_manager: mixin get, set, add_property and get_properties functionality */
        
tstate.add_property_manager = function (obj) {

        // private store for properties goes here
        var props = {};


        obj.get_properties = function () {
            ;
        }

        obj.get = function (prop) {
            ;
        }


        // return a protected "property manager" object that the client can keep secret
        
        var mgr = {};
        
        mgr.set = function (prop, val) {
            ;
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



/* note usages:

        // tstate global must have add_property_manager method
        tstate.add_property_manager(that)

        // but tstate must itself be a function, which returns objects that have a val method:
        tstate("base.url").val()

        // moreover it must copy over methods from the objects it wraps, to allow this shorthand:
        tstate("groups_def").set_source("url", grplink.attr("href"));    // *groups_def* defines set_source()!

        // furthermore, the objects must have some way to associate methods like seturl with the tstate
        // "set" method so that--for those properties which are relevant--the following can work:
        tstate("base.url").set( ... )       // not every property gets a "set" method
*/
