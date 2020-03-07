// be slightly async to allow HMR code to send to plugin
setTimeout(() => {
  if (process.env.NODE_ENV !== 'test') {
    console.log('Test project ran sucessfully')
  }
}, 100);

if (process.env.NODE_ENV !== 'test') module.hot.accept();
