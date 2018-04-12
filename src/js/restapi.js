
import $ from 'jquery'

var apiHost = (!location.href.match(/172.25|localhost/)) ? '/' : '//st.mobizen.com/'

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