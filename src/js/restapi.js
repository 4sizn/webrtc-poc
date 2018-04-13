
import $ from 'jquery'

var apiHost = process.env.PRODUCTION_URL

export function get (url, params, success) {
  var settings = {
    url: apiHost + url,
    type: 'GET',
    data: params,
    dataType: 'json',
    contentType: 'application/json; charset=utf-8'
  }
  if (success) {
    settings.success = success
  }
  return $.ajax(settings)
}

export function post (url, params, success) {
  var settings = {
    url: apiHost + url,
    type: 'POST',
    data: JSON.stringify(params),
    dataType: 'json',
    contentType: 'application/json; charset=utf-8'
  }
  if (success) {
    settings.success = success
  }
  return $.ajax(settings)
}