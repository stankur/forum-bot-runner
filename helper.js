var expandSpaces = (stringWithSpaces, spaceLength) => {
	var space = " ";
	return stringWithSpaces.replace(space, space.repeat(spaceLength));
};

module.exports = {expandSpaces}