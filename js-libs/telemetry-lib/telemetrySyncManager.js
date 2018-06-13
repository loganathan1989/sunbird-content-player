/**
 * This is responsible for syncing of Telemetry
 * @class TelemetrySyncManager
 * @author Krushanu Mohapatra <Krushanu.Mohapatra@tarento.com>
 * @author Manjunath Davanam <manjunathd@ilimi.in>
 */

var TelemetrySyncManager = {

    /**
     * This is the telemetry data for the particular stage.
     * @memberof TelemetryPlugin
     */
    batch: [],
    batchPool: [],
    BATCH_POOL_NAME: 'EkTelemetryEvents',
    init: function() {
        var instance = this;
        var SYNC_INTERVAL = 30000; // 30 sec default
        document.addEventListener('TelemetryEvent', this.sendTelemetry);
        setInterval(function() {
            console.log("Making sync event call");
            if (!instance.isBatchPoolEmpty()) {
                instance.syncEvents(function(err, res) {
                    err && console.warn(err);
                });
            }
        }, SYNC_INTERVAL);
    },
    isBatchPoolEmpty: function() {
        return !this.getBatchPoolFromCache() ? true : false
    },
    sendTelemetry: function(event) {
        var instance = TelemetrySyncManager;
        instance.batch.push(Object.assign({}, event.detail));
        if (instance.batch.length >= EkTelemetry.config.batchsize) {
            instance.updateBatchPool(instance.batch.splice(0, EkTelemetry.config.batchsize));
        }
    },
    updateBatchPool: function(batch) {
        this.batchPool.push(batch);
        var data = this.getBatchPoolFromCache();
        if (!data) {
            this.setBatchPoolInCache(this.batchPool);
        } else {
            data = data.concat(this.batchPool);
            this.setBatchPoolInCache(data);
        }
    },
    setBatchPoolInCache: function(batchPool) {
        window.localStorage.setItem(this.BATCH_POOL_NAME, JSON.stringify(batchPool));
    },
    getBatchPoolFromCache: function() {
        return JSON.parse(window.localStorage.getItem(this.BATCH_POOL_NAME));
    },
    getLatestBatchFromPool: function(limit) {
        var data = JSON.parse(JSON.stringify(this.getBatchPoolFromCache()));
        var splicedData = data.splice(0, limit);
        this.setBatchPoolInCache(data);
        return splicedData;
    },
    syncEvents: function(callback) {
        var instance = this;
        var ERROR_MESSAGE = 'Few events are failed to sync hence stack is updated';
        var BATCH_LIMIT_PER_CALL = 1; // Default;
        var batch = instance.getLatestBatchFromPool(BATCH_LIMIT_PER_CALL);
        if (batch.length) {
            instance.doAjaxCall(batch, function(err, res) {
                if (err) {
                    instance.updateBatchPool(batch);
                    callback(ERROR_MESSAGE, undefined);
                } else {
                    callback(undefined, true);
                }
            })
        }
    },
    doAjaxCall: function(events, callback) {
        var instance = TelemetrySyncManager;
        var Telemetry = EkTelemetry || Telemetry;
        var telemetryObj = {
            "id": "ekstep.telemetry",
            "ver": EkTelemetry._version,
            "ets": (new Date()).getTime(),
            "events": events
        };
        var headersParam = {};
        if ('undefined' != typeof Telemetry.config.authtoken)
            headersParam["Authorization"] = 'Bearer ' + Telemetry.config.authtoken;

        var fullPath = Telemetry.config.host + Telemetry.config.apislug + Telemetry.config.endpoint;
        headersParam['dataType'] = 'json';
        headersParam["Content-Type"] = "application/json";
        jQuery.ajax({
            url: fullPath,
            type: "POST",
            headers: headersParam,
            data: JSON.stringify(telemetryObj)
        }).done(function(resp) {
            console.log("Telemetry API success", resp);
            callback(undefined, true);
        }).fail(function(error, textStatus, errorThrown) {
            callback(new Error('Sync failed!', error.status), undefined);
        });
    },
}
if (typeof document != 'undefined') {
    TelemetrySyncManager.init();
}