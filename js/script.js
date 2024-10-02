jQuery(document).ready(function($) {
    // Lista de países y códigos
    const countries = ep_ajax.countries; // Esto ahora es un objeto con nombres como claves y códigos como valores
    const countryNames = Object.keys(countries); // Obtener solo los nombres de los países

    // Función para eliminar acentos
    function removeAccents(str) {
        const accents = {
            'á': 'a', 'à': 'a', 'ä': 'a', 'â': 'a', 'ã': 'a', 'å': 'a',
            'é': 'e', 'è': 'e', 'ë': 'e', 'ê': 'e',
            'í': 'i', 'ì': 'i', 'ï': 'i', 'î': 'i',
            'ó': 'o', 'ò': 'o', 'ö': 'o', 'ô': 'o', 'õ': 'o',
            'ú': 'u', 'ù': 'u', 'ü': 'u', 'û': 'u',
            'ñ': 'n',
            'ç': 'c',
        };

        return str.split('').map(char => accents[char] || char).join('');
    }

    // Autocompletar para el campo de búsqueda
    $('#mk-destination').autocomplete({
        source: function(request, response) {
            // Normalizar la entrada del usuario
            const normalizedInput = removeAccents(request.term.toLowerCase());

            // Filtrar países que coinciden con la entrada normalizada
            const results = countryNames.filter(country => 
                removeAccents(country.toLowerCase()).includes(normalizedInput)
            );

            // Crear un conjunto para evitar duplicados
            const uniqueResults = [];

            results.forEach(country => {
                if (!uniqueResults.includes(country)) {
                    uniqueResults.push(country); // Agregar la variante en español
                }
            });

            // Evitar que se incluya la versión en inglés
            const englishVariants = countryNames.filter(country => 
                countries[country] !== country && removeAccents(countries[country].toLowerCase()).includes(normalizedInput)
            );

            // Solo agregar la versión en inglés si no se ha agregado la versión en español
            englishVariants.forEach(englishCountry => {
                if (!uniqueResults.includes(englishCountry)) {
                    uniqueResults.push(englishCountry);
                }
            });

            response(uniqueResults);
        },
        minLength: 2, // Mínimo de caracteres para empezar la búsqueda
        select: function(event, ui) {
            const selectedCountry = ui.item.value; // Obtener el nombre del país seleccionado
            $('#mk-destination').val(selectedCountry); // Rellenar el campo con el nombre del país

            // Buscar el código de país correspondiente
            const countryCode = countries[selectedCountry];
            $('#country_code').val(countryCode); // Guardar el código de país en un campo oculto

            console.log("Código de país seleccionado: ", countryCode); // Depuración
            event.preventDefault(); // Evitar que se dispare el evento de clic
        }
    });

    // Resto del código...
 function createPlanHTML(plan) {
    // Verificar si categories existe y es un arreglo
    const isRegional = Array.isArray(plan.categories) && plan.categories.length > 1;

    // Convertir las categorías a una cadena para mostrar en el tooltip
    const categoriesList = isRegional ? plan.categories.join(', ') : '';

    return `
        <div class="mk-plan ${isRegional ? 'regional-plan' : ''}" 
             title="${isRegional ? 'Países incluidos: ' + categoriesList : ''}"> <!-- Tooltip aquí -->
            ${isRegional ? '<div class="regional-title">Plan Regional</div>' : ''}
            <div class="mk-network">
                <img class="mk-flag" src="${plan.flag}" alt="Bandera de ${plan.name}" />
                <span class="mk-pais">${plan.name}</span>
                <img class="mk-connectivity-icon" src="${plan.connectivity === '5g' ? ep_ajax.icon_url + '5Gread.svg' : ep_ajax.icon_url + 'LTE.svg'}" alt="${plan.connectivity} Icono" />
            </div>
            <div class="mk-datos">
                <span class="mk-data">${plan.data} GB</span>
                <span class="mk-validity">${plan.validity} Días</span>
            </div>
            <div class="mk-precio">
                <span class="mk-price">${plan.currency} ${plan.price}</span> <!-- Precio con el símbolo de la moneda -->
            </div>
            <div class="mk-boton">
                <a href="${plan.buy_link}" class="mk-activate-button">Comprar</a>
            </div>
        </div>
    `;
}

//tooltip movil

// Añadir comportamiento para mostrar el tooltip en móviles
$('.mk-plan').on('touchstart', function() {
    const tooltipText = $(this).attr('title'); // Obtener el texto del tooltip
    if (tooltipText) {
        // Crear un elemento tooltip
        const tooltip = $('<div class="mobile-tooltip"></div>').text(tooltipText);
        $('body').append(tooltip);

        // Posicionar el tooltip cerca del elemento tocado
        const offset = $(this).offset();
        tooltip.css({
            top: offset.top - tooltip.outerHeight() - 10, // 10px encima del elemento
            left: offset.left + ($(this).outerWidth() / 2) - (tooltip.outerWidth() / 2) // Centrar
        });

        // Mostrar el tooltip
        tooltip.fadeIn();

        // Ocultar el tooltip al tocar otra parte de la pantalla
        setTimeout(() => {
            tooltip.fadeOut(() => {
                tooltip.remove(); // Eliminar el tooltip del DOM
            });
        }, 3000); // Ocultar después de 3 segundos
    }
});


// resto de la función
    $('.mk-search-button').on('click', function() {
        const countryCode = $('#country_code').val(); // Usar el código de país correspondiente

        console.log("Código de país seleccionado: ", countryCode); // Depuración

        if (countryCode) {
            $('#mk-plans-results').empty().append('<p>Cargando...</p>'); // Mensaje de carga

            $.ajax({
                url: ep_ajax.ajax_url,
                method: 'POST',
                data: {
                    action: 'ep_search_plans',
                    country_code: countryCode // Buscar usando el código ISO3
                },
                success: function(data) {
                    $('#mk-plans-results').empty(); // Limpiar resultados anteriores
                    if (data.length > 0) {
                        $('.mk-plans-header').show(); // Mostrar encabezado de mejores planes
                        data.forEach(function(plan) {
                            $('#mk-plans-results').append(createPlanHTML(plan));
                        });
                    } else {
                        $('#mk-plans-results').append('<p>No se encontraron planes.</p>');
                        $('.mk-plans-header').hide(); // Ocultar encabezado si no hay resultados
                    }
                },
                error: function(jqXHR, textStatus, errorThrown) {
                    alert('Error en la búsqueda de planes: ' + textStatus);
                }
            });
        } else {
            alert('Por favor, ingresa un país válido.');
        }
    });
});
