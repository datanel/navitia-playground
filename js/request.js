function makeDeleteButton() {
    return $('<button/>')
        .addClass('delete')
        .click(function() { $(this).closest('.toDelete').remove(); updateUrl(this); })
        .text('-');
}

function insertRoute(val) {
    $(val).parent().after(makeRoute(''));
}

function makeRoute(val) {
    return $('<span/>')
        .addClass('toDelete')
        .addClass('routeElt')
        .append(' ')
        .append($('<span/>')
                .addClass('pathElt')
                .append($('<input/>')
                        .attr({type: 'text',
                               onfocus: 'updateUrl(this)',
                               onkeyup: 'updateUrl(this)'})
                        .addClass('route')
                        .val(val))
                .append(makeDeleteButton()))
        .append('<button class="add" onclick="insertRoute(this)">+</button>')
}

function makeParam(key, val) {
    var res = $('<span/>')
        .addClass('param')
        .addClass('toDelete')
        .append(' ');

    var attr = {type: 'text', onfocus: 'updateUrl(this)', onkeyup: 'updateUrl(this)'};

    var intputKeyAttr = Object.assign(attr, {class: 'key', value: key});
    res.append($('<input/>', intputKeyAttr));
    res.append('=');
    var inputValAttr = Object.assign(attr, {class: 'value', value: val, onfocus: 'paramsValOnFocus(this)'});
    var valueElt = $('<input/>', inputValAttr);
    if ($.inArray(key, ['from', 'to']) != -1) {
        makeAutocomplete(valueElt);
    }else if (key.match(/datetime$/) {
        makeDatetime(valueElt)
    }
    res.append(valueElt);
    res.append(makeDeleteButton());
    return res;
}

function paramsValOnFocus(valInput){
    var key = $('.key', $(valInput).parent()).val();
    if ($.inArray(key, ['from', 'to']) != -1 &&
        ! $(valInput).attr('class').contains('value ui-autocomplete-input')) {
        makeAutocomplete(valInput)
    }else if (key.match(/datetime$/) &&
              ! $(valInput).attr('class').contains('hasDatepicker')) {
        makeDatetime(valInput)
    } else if ($(valInput).attr('class').contains('ui-autocomplete-input') ||
               $(valInput).attr('class').contains('hasDatepicker')) {

        // Get the delete_button position and the value of valInput before it's removed
        var delete_button = $('.delete', $(valInput).parent());
        var v = $(valInput).val();
	// Remove the current input
        $(valInput).remove();
        // Create a new input
        var valueElt = $('<input/>', {type: 'text',
                                      onfocus: 'updateUrl(this)',
                                      onkeyup: 'updateUrl(this)',
                                      onfocus: 'paramsValOnFocus(this)',
                                      class: 'value',
                                      value: v});
        valueElt.insertBefore(delete_button);
        valInput = valueElt;
    }

    updateUrl(valInput);
}
function insertParam() {
    $("#parameterList").append(makeParam('', ''));
}

function getFocusedElemValue(elemToTest, focusedElem, noEncoding) {
    if (focusedElem == elemToTest) {
        return '<span class="focus_params" style="color:red">{0}</span>'
            .format(noEncoding ? elemToTest.value : elemToTest.value.encodeURI());
    }
    return noEncoding ? elemToTest.value : elemToTest.value.encodeURI();
}

function finalUrl(focusedElem) {
    var finalUrl = getFocusedElemValue($('#api input.api')[0], focusedElem, true);
    $("#route input.route").each(function(){
        finalUrl += '/' + getFocusedElemValue(this, focusedElem);
    });

    finalUrl += '?';

    $('#parameters input.key, #parameters input.value').each(function(){
        finalUrl += getFocusedElemValue(this, focusedElem);
        if ($(this).hasClass('key')) {
            finalUrl += '=';
        }
        if ($(this).hasClass('value')) {
            finalUrl += '&';
        }
    });
    return finalUrl;
}

function submit() {
    var token = $('#token input.token').val();
    var f = finalUrl(); // finalUrl can be called without any args
    window.location = '?request={0}&token={1}'.format(f.encodeURI(), token.encodeURI());
}

function updateUrl(focusedElem) {
    var f = finalUrl(focusedElem);
    $('#urlDynamic span').html(f);
}

function getCoverage() {
    var prevIsCoverage = false;
    var coverage = null;
    var covElt = $("#route input.route").each(function() {
        if (prevIsCoverage) {
            coverage = $(this).val();
        }
        prevIsCoverage = $(this).val() == 'coverage';
    });
    return coverage;
}

function makeAutocomplete(elt) {
    $(elt).autocomplete({
        source: function(request, response) {

            var token = $('#token input.token').val();
            var url = $('#api input.api').val();
            var cov = getCoverage();
            if (cov !== null) {
                url = '{0}/coverage/{1}'.format(url, cov);
            }
            $.ajax({
                url: '{0}/places?q={1}'.format(url, request.term.encodeURI()),
                headers: isUndefined(token) ? {} : { Authorization: "Basic " + btoa(token) },
                success: function(data) {
                    var res = [];
                    if ('places' in data) {
                        data['places'].forEach(function(place) {
                            res.push({ value: place.id, label: place.name });
                        });
                    }
                    response(res);
                },
                error: function() {
                    response([]);
                }
            });
        },
    });
}

function makeDatetime(elt) {
    $(elt).datetimepicker({
        dateFormat: 'yymmdd',
        timeFormat: 'HHmmss',
        timeInput: true,
        separator: 'T',
        controlType: 'select',
        oneLine: true,
    }).focus();
}

$(document).ready(function() {
    var search = new URI(window.location).search(true);
    var token = search['token'];
    if (isUndefined(token)) { token = ''; }
    $("#token input.token").attr('value', token);
    $("#urlFormToken").attr('value', token);

    var request = search['request'];
    if (isUndefined(request)) { return; }

    var req_uri = new URI(request);
    var origin = req_uri.origin();
    var paths = req_uri.path().split('/');
    // The first element after a split is an empty string("")
    if (paths.length == 1) { return; }
    var api = origin;

    var vxxFound = false;
    paths.slice(1).forEach(function(r) {
      if (!r) { return; }
      if (vxxFound) {
        $("#route").append(makeRoute(r.decodeURI()));
      } else {
        api = api + '/' + r.decodeURI();
        vxxFound = /^v\d+$/.test(r);
      }
    })
    $("#api input.api").attr('value', api);

    var params = req_uri.search(true);

    if (! isUndefined(params)) {
        var param_elt = $("#parameterList");
        for (var key in params) {
          var value = params[key];
          // a list of params, ex.: forbidded_uris[]
          if (Array.isArray(value)) {
              value.forEach(function(v){
                param_elt.append(makeParam(key.decodeURI(), v.decodeURI()));
              });
          } else {
            param_elt.append(makeParam(key.decodeURI(), params[key]));
          }
        }
    }
    $('#urlDynamic span').html(request);
});
