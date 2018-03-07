// Monitor server script startup and reload. Should be added at the end of entries
const monitorFn = () => {
  // Handle hot updates, copied from webpack/hot/poll.js
  if (module.hot) {
    const log = (type, msg) => console.warn(`${type}: ${msg}`);
    log('info', 'handling hot updates');
    var checkForUpdate = function checkForUpdate(fromUpdate) {
      module.hot
        .check()
        .then(function(updatedModules) {
          if (!updatedModules) {
            if (fromUpdate) log('info', '[HMR] Update applied.');
            else log('warning', '[HMR] Cannot find update.');
            return;
          }

          return module.hot
            .apply({
              ignoreUnaccepted: true,
              onUnaccepted: function(data) {
                log(
                  'warning',
                  'Ignored an update to unaccepted module ' +
                    data.chain.join(' -> ')
                );
              },
            })
            .then(function(renewedModules) {
              // require('./log-apply-result')(updatedModules, renewedModules);

              checkForUpdate(true);
            });
        })
        .catch(function(err) {
          var status = module.hot.status();
          if (['abort', 'fail'].indexOf(status) >= 0) {
            if (process.send) {
              process.send('SSWP_HMR_FAIL');
            }
            log('warning', '[HMR] Cannot apply update.');
            log('warning', '[HMR] ' + err.stack || err.message);
            console.error(
              '[HMR] Quitting process - will reload on next file change\u0007\n\u0007\n\u0007'
            );
            process.exit(222);
          } else {
            log('warning', '[HMR] Update failed: ' + err.stack || err.message);
          }
        });
    };

    process.on('message', function(message) {
      console.warn('worker> got msg', message);
      if (message !== 'SSWP_HMR') return;

      if (module.hot.status() !== 'idle') {
        log(
          'warning',
          '[HMR] Got signal but currently in ' + module.hot.status() + ' state.'
        );
        log('warning', '[HMR] Need to be in idle state to start hot update.');
        return;
      }

      checkForUpdate();
    });
  }

  // Tell our plugin we loaded all the code without initially crashing
  if (process.send) {
    console.warn('sswp> notifying loaded');
    process.send('SSWP_LOADED');
  }
};

export default monitorFn;
