/*
 * Bar-style basemap picker by GreenInfo Network
 */

L.basemapbar = function (options) {
    return new L.Control.BasemapBar(options);
};


L.Control.BasemapBar = L.Control.extend({
    options: {
        position: 'topright',
        controlid: null,  // specific to this project: things with `id` will be scrolled-to when tab-focused
    },
    initialize: function(options) {
        if (! options.layers || ! Array.isArray(options.layers) ) throw "L.Control.BasemapBar: missing layers list";

        L.setOptions(this,options);

        this.buttons = {};          // random-access to our own buttons, so we can arbitrarily fetch a button by name, e.g. to toggle one programatically
        this.map     = null;        // linkage to our containing L.Map instance
    },
    onAdd: function (map) {
        // add a linkage to the map, since we'll be managing map layers
        this.map = map;

        // pass 1
        // create an internal registry entry for each layer-option, mapping the button text onto the L.tileLayer instance
        // this is the key to the selectLayer() function being able to identify which layer is desired
        this._layers = {};
        for (var i=0, l=this.options.layers.length; i<l; i++) {
            var layeroption = this.options.layers[i];

            // preprocessing
            // standardize the capitalization to always be lowercase; makes things more consistent when testing
            layeroption.label = layeroption.label.toLowerCase();

            switch (layeroption.type) {
                case 'xyz':
                    // XYZ which can be used as a Leaflet L.TileLayer
                    // params:
                    //      url             the URL template of the XYZ tile service, as is usual for a L.TileLayer
                    //      attribution     attribution (text/html) when this layer is showing
                    var options = L.Util.extend({}, layeroption.tileLayerOptions);
                    var tilelayer = L.tileLayer(layeroption.url, options);

                    // hack for WAVE accessibility testing robot; it complains that the map tiles don't have alt tags
                    // nobody can focus them so it's not necessary, but we need to satisfy the robot
                    tilelayer.on('tileload', function (tileEvent) {
                        tileEvent.tile.setAttribute('alt', '');  // if actual content e.g. "Map tile" then WAVE complains it's redundant
                        tileEvent.tile.setAttribute('aria-hidden', 'true');
                    });

                    this._layers[ layeroption.label ] = tilelayer;
                    break;
                case 'google':
                    // Google basemap: various subtypes
                    // params:
                    //      url             the type of Map to use; any of: satellite, streets, terrain
                    //      attribution     NOT USED (here as a note) the Google Maps layer driver already provides the attribution
                    switch (layeroption.url) {
                        case 'satellite':
                            this._layers[ layeroption.label ] = new L.Google('SATELLITE', { zIndex:-1 });
                            break;
                        case 'hybrid':
                            this._layers[ layeroption.label ] = new L.Google('HYBRID', { zIndex:-1 });
                            break;
                        case 'streets':
                            this._layers[ layeroption.label ] = new L.Google('ROADMAP', { zIndex:-1 });
                            break;
                        case 'terrain':
                            this._layers[ layeroption.label ] = new L.Google('TERRAIN', { zIndex:-1 });
                            break;
                    }
                    break;
                case 'bing':
                    // Bing basemap: various subtypes
                    // params:
                    //      apikey      the Bing Maps API key to use for this layer
                    //      url         the type of Map to use; any of: aerial, street
                    switch (layeroption.url) {
                        case 'aerial':
                            this._layers[ layeroption.label ] = new L.BingLayer(layeroption.apikey, { zIndex:-1, type:'Aerial' });
                            break;
                        case 'street':
                            this._layers[ layeroption.label ] = new L.BingLayer(layeroption.apikey, { zIndex:-1, type:'Road' });
                            break;
                        default:
                            throw("L.Control.BasemapBar: Unknown Bing subtype ("+layeroption.url+") Must be: street, aerial");
                            break;
                    }
                    break;
                default:
                    throw("L.Control.BasemapBar: Unknown layer 'type' ("+layeroption.type+") Must be: xyz, bing, google");
                    break;
            } // end of layer type switch
        }

        // pass 2
        // create a button for each registered layer, complete with a data attribute for the layer to get toggled, and a linkage to the parent control
        var controlDiv = L.DomUtil.create('div', 'leaflet-control-basemapbar');
        if (this.options.controlid) {
            controlDiv.id = 'basemapbar-' + this.options.controlid;
        }
        for (var i=0, l=this.options.layers.length; i<l; i++) {
            var label            = this.options.layers[i].label;
            var tooltip          = this.options.layers[i].tooltip ? this.options.layers[i].tooltip : '';

            var button           = L.DomUtil.create('div', 'leaflet-control-basemapbar-option', controlDiv);
            button.control       = this;
            button.innerHTML     = label.toUpperCase();
            button.title         = tooltip;
            button.tabIndex = 0;
            button['data-layer'] = label;

            if (this.options.controlid) {
                button.id = 'basemapbar-button-' + i + '-' + this.options.controlid;
            }

            // on a click on a button, it calls the control's selectLayer() method by name
            L.DomEvent
                .addListener(button, 'mousedown', L.DomEvent.stopPropagation)
                .addListener(button, 'click', L.DomEvent.stopPropagation)
                .addListener(button, 'click', L.DomEvent.preventDefault)
                .addListener(button, 'click', function () {
                    // select the given basemap
                    this.control.selectLayer( this['data-layer'] );
                });
            button.addEventListener('keypress', function (e) {
                if (e.key !== 'Enter') return;
                e.target.click();
            });

            // add the button to our internal random-access list, so we can arbitrarily fetch buttons later, e.g. to toggle one programatically
            this.buttons[label] = button;
        }

        // afterthought: add Open and Close buttons to the list, which when clicked, expands/collapses the other buttons
        this.closer = L.DomUtil.create('div', 'leaflet-control-basemapbar-close', controlDiv);
        this.closer.innerHTML = '&times;';
        this.closer.title     = 'Hide basemap selector';
        this.closer.tabIndex = 0;
        this.closer.control   = this;
        L.DomEvent
            .addListener(this.closer, 'mousedown', L.DomEvent.stopPropagation)
            .addListener(this.closer, 'click', L.DomEvent.stopPropagation)
            .addListener(this.closer, 'click', L.DomEvent.preventDefault)
            .addListener(this.closer, 'click', function () {
                this.control.collapseUI();
            });
        this.closer.addEventListener('keypress', (e) => {
            if (e.key !== 'Enter') return;
            this.closer.click();
            this.opener.focus();  // Safari doesn't support focus() and has other accessibility issues
        });

        this.opener = L.DomUtil.create('div', 'leaflet-control-basemapbar-open', controlDiv);
        this.opener.innerHTML = 'Map';
        this.opener.title     = 'Show options for the base map';
        this.opener.tabIndex = 0;
        this.opener.control   = this;
        L.DomEvent
            .addListener(this.opener, 'mousedown', L.DomEvent.stopPropagation)
            .addListener(this.opener, 'click', L.DomEvent.stopPropagation)
            .addListener(this.opener, 'click', L.DomEvent.preventDefault)
            .addListener(this.opener, 'click', function () {
                this.control.expandUI();
            });
        this.opener.addEventListener('keypress', (e) => {
            if (e.key !== 'Enter') return;
            this.opener.click();
            this.closer.focus();  // Safari doesn't support focus() and has other accessibility issues
        });

        if (this.options.controlid) {
            this.closer.id = 'basemapbar-closer-' + i + '-' + this.options.controlid;
            this.opener.id = 'basemapbar-opener-' + i + '-' + this.options.controlid;
        }

        // and on launch.... collapse the UI
        this.collapseUI();

        // stop click & scroll propagation
        L.DomEvent.disableScrollPropagation(controlDiv);
        L.DomEvent.disableClickPropagation(controlDiv);

        // done!
        return controlDiv;
    },
    selectLayer: function (which) {
        // selectLayer() is *the* public method to trigger the basemap picker to select a layer, highlight appropriately, and trigger a change in the map layers
        for (var tag in this.buttons) {
            var button = this.buttons[tag];
            if (tag == which) {
                L.DomUtil.addClass(button,'leaflet-control-basemapbar-option-active');
                this.map.addLayer(this._layers[tag],true);
            } else {
                L.DomUtil.removeClass(button,'leaflet-control-basemapbar-option-active');
                this.map.removeLayer(this._layers[tag]);
            }
        }

        // return myself cuz method chaining is awesome
        return this;
    },
    whichLayer: function () {
        for (var tag in this.buttons) {
            var button = this.buttons[tag];
            if ( L.DomUtil.hasClass(button,'leaflet-control-basemapbar-option-active') ) return tag;
        }
        return null; // impossible, none of them at all
    },
    collapseUI: function () {
        // add the CSS which hides the picker buttons
        for (var tag in this.buttons) {
            var button = this.buttons[tag];
            L.DomUtil.addClass(button,'leaflet-control-basemapbar-hidden');
        }

        // then add/remove CSS to show/hide the opener/closer button
        L.DomUtil.addClass(this.closer, 'leaflet-control-basemapbar-hidden');
        L.DomUtil.removeClass(this.opener, 'leaflet-control-basemapbar-hidden');

        // return myself cuz method chaining is awesome
        return this;
    },
    expandUI: function () {
        // remove the CSS which hides the picker buttons
        for (var tag in this.buttons) {
            var button = this.buttons[tag];
            L.DomUtil.removeClass(button,'leaflet-control-basemapbar-hidden');
        }

        // then add/remove CSS to show/hide the opener/closer button
        L.DomUtil.removeClass(this.closer, 'leaflet-control-basemapbar-hidden');
        L.DomUtil.addClass(this.opener, 'leaflet-control-basemapbar-hidden');

        // return myself cuz method chaining is awesome
        return this;
    }
});
