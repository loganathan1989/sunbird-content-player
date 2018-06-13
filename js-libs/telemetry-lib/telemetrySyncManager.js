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
    timer: undefined,
    isSyncInProgress: false,
    init: function() {
        var instance = this;
        document.addEventListener('TelemetryEvent', this.sendTelemetry);
        window.onbeforeunload = function() {
            instance.updateBatchPool(instance.batch);
        }
    },
    startTimer: function() {
        var SYNC_INTERVAL = EkTelemetry.config.syncInterval || 30000; // 30 sec default
        var instance = this;
        timer = setTimeout(function() {
            console.info("Sync is failed, Hence auto sync is happening");
            clearTimeout(timer);
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
            var batchEvents = instance.batch.splice(0, EkTelemetry.config.batchsize);
            instance.updateBatchPool(batchEvents);
            !instance.isSyncInProgress && instance.syncBatch(instance);
        }
    },
    syncBatch: function(instance) {
        var batchEvents = instance.getBatch();
        instance.sync(batchEvents, function(err, res) {
            console.log("Err", err);
            if (res) {
                instance.syncBatch(instance);
            } else {
                instance.startTimer();
            }
        });
    },
    updateBatchPool: function(batch) {
        var batchPool = this.getBatchPool();
        batchPool = !batchPool ? [] : batchPool
        batchPool.unshift(batch);
        window.localStorage.setItem(this.BATCH_POOL_NAME, JSON.stringify(batchPool));
    },
    getBatchPool: function() {
        return JSON.parse(window.localStorage.getItem(this.BATCH_POOL_NAME));
    },
    getBatch: function() {
        var data = JSON.parse(JSON.stringify(this.getBatchPool()));
        var splicedData = data.pop();
        window.localStorage.setItem(this.BATCH_POOL_NAME, JSON.stringify(data));
        return splicedData;
    },
    sync: function(batch, callback) {
        var instance = this;
        var ERROR_MESSAGE = 'Few events are failed to sync hence stack is updated';
        if (batch && batch.length) {
            instance.isSyncInProgress = true;
            instance.doAjaxCall(batch, function(err, res) {
                instance.isSyncInProgress = false;
                if (err) {
                    instance.updateBatchPool(batch);
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
        var telemetryObj = {
            "id": "ekstep.telemetry",
            "ver": EkTelemetry._version,
            "ets": (new Date()).getTime(),
            "events": events
        };
        var headersParam = {};
        if ('undefined' != typeof EkTelemetry.config.authtoken)
            headersParam["Authorization"] = EkTelemetry.config.authtoken;

        var fullPath = EkTelemetry.config.host + EkTelemetry.config.apislug + EkTelemetry.config.endpoint;
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