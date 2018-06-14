var TelemetryCache = {
    _cache: [],
    CACHE_NAME: 'EkTelemetryEvents',
    push: function(item) {
        // Add element to bottom of the cache
        this._cache.push(item);
        this.sync();
    },
    shift: function() {
        // Return element from top of cache
        var topElement = this._cache.shift();
        this.sync();
        return topElement;
    },
    unshift: function(item) {
        // Add element to top of the cache
        this._cache.unshift(item);
        this.sync();
    },
    sync: function() {
        window.localStorage.setItem(this.CACHE_NAME, JSON.stringify(this._cache));
    },
    init: function() {
        var cacheStore = JSON.parse(window.localStorage.getItem(this.CACHE_NAME));
        this._cache = cacheStore ? cacheStore : [];
    },
    getCache: function(limit) {
        var batches = this._cache.splice(0, limit);
        this.sync();
        return batches
    }
};

var TelemetrySyncManager = {
    _batch: [],
    CACHE_LIMIT: 10,
    SYNC_INTERVAL_PER_CALL: 30000, // default, 30sec
    init: function() {
        var instance = this;
        TelemetryCache.init();
        document.addEventListener('TelemetryEvent', this.telemetryEvent);
        window.onbeforeunload = function() {
            instance._batch.length && TelemetryCache.push(instance._batch);
        }
        setInterval(function() {
            instance.sendTelemetry(TelemetryCache.getCache(instance.CACHE_LIMIT), function(error, resp) {
                error && TelemetryCache.unshift(resp);
            });
        }, EkTelemetry.config.syncInterval || instance.SYNC_INTERVAL_PER_CALL);
    },
    telemetryEvent: function(event) {
        var instance = TelemetrySyncManager;
        instance._batch.push(Object.assign({}, event.detail));
        if (instance._batch.length >= EkTelemetry.config.batchsize) {
            TelemetryCache.push(instance._batch.splice(0, EkTelemetry.config.batchsize));
        }
    },
    sendTelemetry: function(batches, callback) {
        var HEADER = this.getHeaders();
        var URL = EkTelemetry.config.host + EkTelemetry.config.apislug + EkTelemetry.config.endpoint;
        batches.forEach(function(index) {
            (function(batch) {
                if (batch && batch.length) {
                    var instance = TelemetrySyncManager;
                    var telemetryObj = {
                        "id": "ekstep.telemetry",
                        "ver": EkTelemetry._version,
                        "ets": (new Date()).getTime(),
                        "events": batch // batch of events [{},{}]
                    };
                    jQuery.ajax({
                        url: URL,
                        type: "POST",
                        headers: HEADER,
                        data: JSON.stringify(telemetryObj)
                    }).done(function(resp) {
                        console.log("Telemetry API success", resp);
                        callback(undefined, resp);
                    }).fail(function(error, textStatus, errorThrown) {
                        callback(new Error('Sync failed!', error.status), batch);
                    });
                }
            }(index))
        });
    },
    getHeaders: function() {
        var headersParam = {};
        if ('undefined' != typeof EkTelemetry.config.authtoken)
            headersParam["Authorization"] = 'Bearer ' + EkTelemetry.config.authtoken;
        headersParam['dataType'] = 'json';
        headersParam["Content-Type"] = "application/json";
        return headersParam;
    }

}
if (typeof document != 'undefined') {
    TelemetrySyncManager.init();
}