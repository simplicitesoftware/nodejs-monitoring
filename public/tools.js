function row() {
	return $('<div/>').addClass('row');
}

function cell(span) {
	return $('<div/>').addClass('col-md-' + span);
}

function panel(body, heading, style, span) {
	var p = $('<div/>').addClass('panel panel-' + (style === undefined ? 'default' : style));
	p.append($('<div/>').addClass('panel-heading').append($('<h3/>').addClass('panel-title').append(heading)));
	p.append($('<div/>').addClass('panel-body').append(body));
	if (span) return cell(span).append(p);
	return p;
}
