export function errorHandler(err, req, res, next) {
  console.log('Error occurred:  ' + err.message);
  if (err.errors) {
    console.error(
      'Dettagli:',
      err.errors.map((e) => e.message)
    );
  }
  console.log('Error stack: ' + err.stack);
  res.status(err.status || 500).json({
    code: err.status || 500,
    description: err.message || 'An error occurred',
  });
}
