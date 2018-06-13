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
    BATCH_LIMIT_PER_CALL: 1,
    timer: undefined,
    init: function() {
        var instance = this;
        document.addEventListener('TelemetryEvent', this.sendTelemetry);
    },
    startTimer: function() {
        var SYNC_INTERVAL = EkTelemetry.config.syncInterval || 30000; // 30 sec default
        var instance = this;
        timer = setInterval(function() {
            console.info("Sync is failed, Hence auto sync is happening");
            instance.syncBatch(instance);
        }, SYNC_INTERVAL);
    },
    isBatchPoolEmpty: function() {
        return !this.getBatchPoolFromCache() ? true : false
    },
    sendTelemetry: function(event) {
        var instance = TelemetrySyncManager;
        instance.batch.push(Object.assign({}, event.detail));
        if (instance.batch.length >= EkTelemetry.config.batchsize) {
            var eventsBatch = instance.batch.splice(0, EkTelemetry.config.batchsize);
            instance.batchPool.push(eventsBatch);
            instance.setBatchPoolInCache(instance.batchPool);
            instance.syncBatch(instance);
        }
    },
    syncBatch: function(instance) {
        var batchEvents = instance.getBatch();
        instance.sync(batchEvents, function(err, res) {
            console.log("Err", err);
            if (res) {
                instance.syncBatch(instance);
            } else {
                instance.updateBatchPool(batchEvents);
                instance.startTimer();
            }
        });
    },
    updateBatchPool: function(batch) {
        var cachedBatchPool = this.getBatchPool();
        window.localStorage.setItem(this.BATCH_POOL_NAME, JSON.stringify(cachedBatchPool.splice(0, 0, batch)));
    },
    getBatchPool: function() {
        return JSON.parse(window.localStorage.getItem(this.BATCH_POOL_NAME));
    },
    getBatch: function() {
        var data = JSON.parse(JSON.stringify(this.getBatchPool()));
        var splicedData = data.splice(0, 1);
        this.setBatchPoolInCache(data);
        return splicedData;
        // TODO: remove from cache after success
    },
    sync: function(batch, callback) {
        var instance = this;
        var ERROR_MESSAGE = 'Few events are failed to sync hence stack is updated';
        if (batch && batch.length) {
            instance.doAjaxCall(batch, function(err, res) {
                if (err) {
                    instance.setBatchPoolInCache(batch);
                    !instance.timer && instance.startTimer();
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