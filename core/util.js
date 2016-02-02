function createResponse (data, err) {
    data.status = true;

    if (err) {
        data.status = false;
        data.errCode = 1; // TODO: change with proper error code
        data.errorMsg = err.message; // TODO: change with proper error message
    }

    return data;
}

exports.createResponse = createResponse;