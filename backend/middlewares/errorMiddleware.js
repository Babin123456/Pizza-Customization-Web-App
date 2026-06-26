const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack
  });
};

const sendErrorProd = (err, res) => {
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      error: err.message
    });
  } else {
    console.error('ERROR 💥', err);
    res.status(500).json({
      status: 'error',
      error: 'Something went wrong on the server'
    });
  }
};

const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    let error = { ...err };
    error.message = err.message;
    error.name = err.name;

    // Handle Mongoose cast errors (e.g. invalid IDs)
    if (error.name === 'CastError') {
      error.message = `Invalid ${error.path}: ${error.value}`;
      error.statusCode = 400;
      error.isOperational = true;
      error.status = 'fail';
    }

    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(el => el.message);
      error.message = `Invalid input data: ${messages.join('. ')}`;
      error.statusCode = 400;
      error.isOperational = true;
      error.status = 'fail';
    }

    // Handle JWT invalid errors
    if (error.name === 'JsonWebTokenError') {
      error.message = 'Invalid token. Please log in again.';
      error.statusCode = 401;
      error.isOperational = true;
      error.status = 'fail';
    }

    // Handle JWT expired errors
    if (error.name === 'TokenExpiredError') {
      error.message = 'Your token has expired! Please log in again.';
      error.statusCode = 401;
      error.isOperational = true;
      error.status = 'fail';
    }

    sendErrorProd(error, res);
  }
};

export default globalErrorHandler;
