jQuery(document).ready(function ($) {
    // Definir variables globales
    let currentPage = 1;
    let allPlans = []; // Almacenar todos los planes obtenidos
    let selectedFilters = {
        duration: null,
        data: null,
        planType: null
    };

    // Mapeo de países y códigos
    const countries = ep_ajax.countries;
    const uniqueCountries = {};
    $.each(countries, function (name, code) {
        if (!uniqueCountries[code]) uniqueCountries[code] = [];
        uniqueCountries[code].push(name);
    });

    // Lista de Regiones con sus nombres en español
    const regions = {
        "Europa": "europa",
        "Asia": "asia",
        "Latinoamérica": "latinoamerica",
        "Caribe": "caribe",
        "Medio Oriente": "oriente-medio",
        "Balcanes": "balcanes",
        "Cáucaso": "caucaso"
    };

    // Manejar el clic en los botones de aplicar y restablecer filtros
    $('#apply-filters').on('click', applyFilters);
    $('#reset-filters').on('click', resetFilters);

    // Funciones de utilidades
    function removeAccents(str) {
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    function normalizeString(str) {
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    }

    function findCountryCodeByName(countryName) {
        const normalizedInput = normalizeString(countryName);
        let exactMatch = null;
        let partialMatch = null;

        for (const [name, code] of Object.entries(countries)) {
            const normalizedName = normalizeString(name);
            if (normalizedName === normalizedInput) { // Coincidencia exacta
                exactMatch = code;
                break; // Prioridad a la coincidencia exacta
            } else if (normalizedName.includes(normalizedInput)) { // Coincidencia parcial
                partialMatch = code;
            }
        }

        return exactMatch || partialMatch || null;
    }

    function getCountrySuggestions(userInput) {
        const normalizedInput = normalizeString(userInput);
        const suggestions = [];

        for (const [code, names] of Object.entries(uniqueCountries)) {
            let bestMatchName = null;
            let bestMatchScore = 0;

            for (const name of names) {
                const normalizedName = normalizeString(name);

                // Verificar coincidencia
                if (normalizedName.includes(normalizedInput)) {
                    // Asignar mayor puntaje si la coincidencia es al inicio
                    const score = normalizedName.startsWith(normalizedInput) ? 2 : 1;

                    if (score > bestMatchScore) {
                        bestMatchScore = score;
                        bestMatchName = name;
                    }
                }
            }

            if (bestMatchName) {
                suggestions.push({
                    name: bestMatchName,
                    code: code,
                    matchScore: bestMatchScore
                });
            }
        }

        // Ordenar las sugerencias por puntaje de coincidencia
        suggestions.sort((a, b) => b.matchScore - a.matchScore);

        return suggestions;
    }

    // Validar la lista de categorías de WooCommerce
    if (!ep_ajax.wc_categories || !Array.isArray(ep_ajax.wc_categories)) {
        return;
    }

    // Función para renderizar paginación
    function renderPagination(totalPages) {
        let paginationHTML = '';

        if (totalPages > 1) {
            paginationHTML += '<div class="pagination">';

            // Botón "Anterior"
            if (currentPage > 1) {
                paginationHTML += `<span class="pagination-prev" data-page="${currentPage - 1}">&laquo; Anterior</span>`;
            } else {
                paginationHTML += `<span class="pagination-prev disabled">&laquo; Anterior</span>`;
            }

            // Números de página avanzados
            const pageWindow = 2; // Número de páginas a mostrar a cada lado de la actual
            const startPage = Math.max(1, currentPage - pageWindow);
            const endPage = Math.min(totalPages, currentPage + pageWindow);

            if (startPage > 1) {
                paginationHTML += `<span class="pagination-page" data-page="1">1</span>`;
                if (startPage > 2) {
                    paginationHTML += `<span class="pagination-ellipsis">...</span>`;
                }
            }

            for (let i = startPage; i <= endPage; i++) {
                if (i === currentPage) {
                    paginationHTML += `<span class="pagination-page current">${i}</span>`;
                } else {
                    paginationHTML += `<span class="pagination-page" data-page="${i}">${i}</span>`;
                }
            }

            if (endPage < totalPages) {
                if (endPage < totalPages - 1) {
                    paginationHTML += `<span class="pagination-ellipsis">...</span>`;
                }
                paginationHTML += `<span class="pagination-page" data-page="${totalPages}">${totalPages}</span>`;
            }

            // Botón "Siguiente"
            if (currentPage < totalPages) {
                paginationHTML += `<span class="pagination-next" data-page="${currentPage + 1}">Siguiente &raquo;</span>`;
            } else {
                paginationHTML += `<span class="pagination-next disabled">Siguiente &raquo;</span>`;
            }

            paginationHTML += '</div>';
        }

        $('#countries-pagination').html(paginationHTML);
    }

    // Paginación
    const countriesPerPage = 30; // Número de países por página

    // Función para cargar y mostrar la lista de países en orden alfabético
    function loadCountries(page = 1) {
        // Verificar si 'ep_ajax.wc_categories' está definido y es un array
        if (!ep_ajax.wc_categories || !Array.isArray(ep_ajax.wc_categories)) {
            return;
        }

        const availableCategories = ep_ajax.wc_categories.map(code => code.toLowerCase());

        // Filtrar los países que tienen categorías disponibles
        const filteredCountries = Object.entries(uniqueCountries).filter(([code, names]) => {
            return availableCategories.includes(code.toLowerCase());
        });

        // Ordenar los países por nombre
        const sortedFilteredCountries = filteredCountries.sort((a, b) => {
            const countryNameA = a[1][0].toLowerCase();
            const countryNameB = b[1][0].toLowerCase();
            return countryNameA.localeCompare(countryNameB);
        });

        // Calcular el total de páginas
        const totalCountries = sortedFilteredCountries.length;
        const totalPages = Math.ceil(totalCountries / countriesPerPage);

        // Asegurar que la página actual esté dentro de los límites
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;

        currentPage = page; // Actualizar la página actual

        // Obtener los países para la página actual
        const startIndex = (currentPage - 1) * countriesPerPage;
        const endIndex = startIndex + countriesPerPage;
        const countriesToDisplay = sortedFilteredCountries.slice(startIndex, endIndex);

        // Generar el HTML de los países para la página actual
        let countryHTML = '';
        countriesToDisplay.forEach(([code, names]) => {
            const name = names[0];
            countryHTML += `
                <div class="country-item" data-country-code="${code}">
                    <img src="${ep_ajax.icon_url}${code.toLowerCase()}.svg" alt="${name} flag" class="country-flag">
                    <span class="country-name">${name}</span>
                </div>
            `;
        });

        // Insertar el HTML en el contenedor
        $('#countries-list').html(countryHTML);

        // Mostrar la paginación solo si la lista de países es visible y hay más de una página
        if ($('#countries-list').hasClass('visible') && totalPages > 1) {
            console.log('Mostrando paginación');
            renderPagination(totalPages);
            $('#countries-pagination').show();
        } else {
            console.log('Ocultando paginación');
            $('#countries-pagination').hide();
        }
    }

    // Función para cargar y mostrar la lista de regiones en español
    function loadRegions() {
        let regionHTML = '';
        $.each(regions, function (regionName, regionSlug) {
            regionHTML += `
                <div class="region-item" data-region-slug="${regionSlug}">
                    <img src="${ep_ajax.icon_url}${regionSlug}.svg" alt="${regionName} flag" class="country-flag">
                    <span class="country-name">${regionName}</span>
                </div>
            `;
        });

        // Insertar el HTML en el contenedor de regiones
        $('#regions-list').html(regionHTML);
    }

    // Inicializar las pestañas correctamente
    $('.mk-tab.active').each(function () {
        const target = $(this).data('tab-target');
        $(target).addClass('visible').css({ maxHeight: 2500, opacity: 1 });
    });

    // Llamar a la función para cargar los países y regiones al iniciar
    loadCountries();
    loadRegions();

    // Autocompletado del buscador de países
    $('#mk-destination').on('input', function () {
        const searchTerm = $(this).val();
        $('#country-suggestions').empty().hide(); // Limpiar sugerencias previas

        // Verificar si `searchTerm` es válido
        if (searchTerm.length > 2) {
            const suggestions = getCountrySuggestions(searchTerm);

            // Verificar si hay sugerencias
            if (suggestions && suggestions.length > 0) {
                let suggestionsHTML = '';
                suggestions.forEach(function(suggestion) {
                    suggestionsHTML += `<div class="suggestion-item" data-country-code="${suggestion.code}">${suggestion.name}</div>`;
                });

                $('#country-suggestions').html(suggestionsHTML).show();

                // Ajustar la posición del contenedor
                const inputOffset = $('#mk-destination').offset();
                $('#country-suggestions').css({
                    position: 'absolute',
                    width: $('#mk-destination').outerWidth(),
                    zIndex: 1000,
                    backgroundColor: '#fff',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    maxHeight: '200px',
                    overflowY: 'auto'
                });
            }
        }
    });

    // Manejar clic en una sugerencia
    $(document).on('click', '.suggestion-item', function () {
        const countryCode = $(this).data('country-code');
        const countryName = $(this).text();
        $('#mk-destination').val(countryName);
        $('#country_code').val(countryCode);
        $('#country-suggestions').empty().hide(); // Ocultar sugerencias
        searchPlans(countryCode, false);
    });

    // Ocultar sugerencias al hacer clic fuera
    $(document).on('click', function (e) {
        if (!$(e.target).closest('#mk-destination, #country-suggestions').length) {
            $('#country-suggestions').empty().hide();
        }
    });

    // Manejar la tecla Enter en el campo de entrada
    $('#mk-destination').on('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault(); // Evitar el comportamiento por defecto
            const searchTerm = $(this).val();
            const countryCode = findCountryCodeByName(searchTerm);

            if (countryCode) {
                $('#country_code').val(countryCode);
                $('#country-suggestions').empty().hide();
                searchPlans(countryCode, false);
            }
        }
    });

    // Lógica para cambiar de pestañas al hacer clic
    $('.mk-tab').on('click', function () {
        const target = $(this).data('tab-target');
        $('.mk-tab').removeClass('active');
        $(this).addClass('active'); // Activar la pestaña seleccionada
        $('.filter-list').removeClass('visible').css({ maxHeight: 0, opacity: 0 });
        $(target).addClass('visible').css({ maxHeight: 2500, opacity: 1 });

        // Ocultar los resultados de planes si están visibles
        $('#mk-plans-results').removeClass('visible').hide();
        $('.mk-plans-header').hide();

        // Mostrar u ocultar la paginación según la pestaña activa
        if (target === '#countries-list') {
            loadCountries(); // Cargar países y controlar la paginación
        } else {
            $('#countries-pagination').hide();
        }
    });

    // Manejar clic en cada país
    $(document).on('click', '.country-item', function () {
        const countryCode = $(this).data('country-code');
        $('#countries-list').removeClass('visible').css({ maxHeight: 0, opacity: 0 }); // Ocultar la lista de países
        searchPlans(countryCode, false); // Buscar planes del país seleccionado
        $('#mk-plans-results').show().addClass('visible');
    });

    // Manejar clic en cada región
    $(document).on('click', '.region-item', function () {
        const regionSlug = $(this).data('region-slug'); // Usar el slug de la región
        $('#regions-list').removeClass('visible').css({ maxHeight: 0, opacity: 0 });
        searchPlans(regionSlug, true); // Búsqueda parcial por slug de región
        $('#mk-plans-results').show().addClass('visible');
    });

    // Manejar clic en los números de página
    $(document).on('click', '.pagination-page', function () {
        const page = parseInt($(this).data('page'));
        if (!isNaN(page)) {
            loadCountries(page);
        }
    });

    // Manejar clic en "Anterior"
    $(document).on('click', '.pagination-prev', function () {
        if (!$(this).hasClass('disabled')) {
            const page = parseInt($(this).data('page'));
            if (!isNaN(page)) {
                loadCountries(page);
            }
        }
    });

    // Manejar clic en "Siguiente"
    $(document).on('click', '.pagination-next', function () {
        if (!$(this).hasClass('disabled')) {
            const page = parseInt($(this).data('page'));
            if (!isNaN(page)) {
                loadCountries(page);
            }
        }
    });

    // Evento para el botón de toggle de filtros
    $('#filter-toggle-button').on('click', function() {
        $(this).toggleClass('active');
        $('#mk-filters').toggleClass('active');
    });

    // Función para aplicar los filtros
    function applyFilters() {
        if (!allPlans || allPlans.length === 0) {
            console.log("No hay planes disponibles para filtrar.");
            console.log(allPlans);
            return;
        }

        let filteredPlans = allPlans.slice(); // Copiar el array de planes original

        // Filtrar por Duración
        if (selectedFilters.duration) {
            filteredPlans = filteredPlans.filter(plan => {
                return parseInt(plan.validity) === parseInt(selectedFilters.duration);
            });
        }

        // Filtrar por Datos
        if (selectedFilters.data) {
            filteredPlans = filteredPlans.filter(plan => {
                return parseInt(plan.data) === parseInt(selectedFilters.data);
            });
        }

        // Filtrar por Tipo de Plan
        if (selectedFilters.planType) {
            filteredPlans = filteredPlans.filter(plan => plan.coverage_type === selectedFilters.planType);
        }

        // Mostrar los planes filtrados en consola (para depuración)
        console.log("Planes filtrados:", filteredPlans);

        // Actualizar la visualización de los planes
        renderPlans(filteredPlans);
    }

    // Función para restablecer los filtros
    function resetFilters() {
        // Restablecer valores seleccionados
        selectedFilters = { duration: null, data: null, planType: null };

        // Eliminar clase 'active' de todas las pestañas
        $('.filter-tab').removeClass('active');

        console.log('Filtros restablecidos:', selectedFilters);

        // Restablecer los planes a la lista completa
        renderPlans(allPlans);
    }

    // Manejar eventos de clic en los botones de filtros con funcionalidad de toggle
    $('.filter-tabs').on('click', function (e) {
        if ($(e.target).hasClass('filter-tab')) {
            const group = $(this);
            const clickedTab = $(e.target);
            const filterType = group.attr('id').replace('filter-', ''); // 'duration', 'data', 'planType'
            const filterValue = clickedTab.data('value');

            if (clickedTab.hasClass('active')) {
                // Si el botón ya está activo, desactivarlo y eliminar el filtro
                clickedTab.removeClass('active');
                selectedFilters[filterType] = null;
            } else {
                // Si el botón no está activo, activarlo y desactivar otros en el grupo
                group.find('.filter-tab').removeClass('active');
                clickedTab.addClass('active');
                selectedFilters[filterType] = filterValue;
            }

            console.log('Filtros seleccionados:', selectedFilters);

            // Aplicar los filtros cada vez que se selecciona o deselecciona un valor
            applyFilters();
        }
    });

    // Manejar clic en el botón "Comprar"
    $(document).on('click', '.mk-activate-button', function () {
        const productId = $(this).data('product-id');
        const checkoutUrl = `${ep_ajax.checkout_url}?add-to-cart=${productId}`;
        window.location.href = checkoutUrl;
    });

    // Evento para mostrar/ocultar la cobertura en planes regionales
    $(document).on('click', '.region-title', function() {
        $(this).siblings('.mk-coverage').toggleClass('visible');
    });

    // Función para buscar planes (adaptada para aceptar país o región)
    function searchPlans(searchTerm, isRegion = false) {
        if (searchTerm) {
            const $plansResults = $('#mk-plans-results');
            const $plansHeader = $('.mk-plans-header');

            // Ocultar listas de países y regiones
            $('#countries-list').removeClass('visible').css({ maxHeight: 0, opacity: 0 });
            $('#regions-list').removeClass('visible').css({ maxHeight: 0, opacity: 0 });

            // Ocultar la paginación al mostrar los planes
            $('#countries-pagination').hide();

            // Mostrar mensaje de carga y ocultar resultados previos
            $plansResults.empty().append('<p>' + ep_ajax.cargando + '</p>');
            $plansHeader.hide();
            $plansResults.removeClass('visible').css('opacity', '0');

            // Datos que se envían a la búsqueda
            const searchData = {
                action: 'ep_search_plans',
                nonce: ep_ajax.nonce,
                region_slug: isRegion ? searchTerm : null, // Enviar region_slug si es región
                country_code: !isRegion ? searchTerm : null, // Enviar country_code si no es región
                // Agregar el tipo de plan si está seleccionado
                plan_type: selectedFilters.planType ? selectedFilters.planType : null
            };

            // Eliminar los campos que sean null para evitar conflictos
            if (searchData.region_slug === null) delete searchData.region_slug;
            if (searchData.country_code === null) delete searchData.country_code;
            if (searchData.plan_type === null) delete searchData.plan_type;

            $.ajax({
                url: ep_ajax.ajax_url,
                method: 'POST',
                data: searchData,
                success: function (data) {
                    $plansResults.empty();
                    if (data.success && data.data.length > 0) {
                        allPlans = data.data; // Guardar todos los planes obtenidos
                        // Mostrar los filtros
                        $('#mk-filters').show();
                        $plansHeader.show();
                        renderPlans(allPlans); // Renderizar los planes
                        // Ocultar el autocompletado al mostrar los planes
                        $('#country-suggestions').empty().hide();
                    } else {
                        // Si no se encuentran planes, mostrar mensaje y ocultar filtros
                        $plansResults.append('<p>' + ep_ajax.no_planes + '</p>');
                        $plansHeader.hide();
                        $('#mk-filters').hide();
                    }
                },
                error: function (jqXHR, textStatus, errorThrown) {
                    $plansResults.html('<p>' + ep_ajax.error + '</p>');
                }
            });
        }
    }

    // Función para renderizar los planes
    function renderPlans(plans) {
        const $plansResults = $('#mk-plans-results');
        $plansResults.empty();

        if (plans.length > 0) {
            // Ordenar los planes por tipo y luego por precio
            function getPlanTypeOrder(plan) {
                if (plan.coverage_type === 'local') {
                    return 1; // Local
                } else if (plan.coverage_type === 'region') {
                    return 2; // Regional
                } else if (plan.coverage_type === 'global') {
                    return 3; // Global
                } else {
                    return 4; // Otros
                }
            }

            plans.sort(function (a, b) {
                var typeOrderA = getPlanTypeOrder(a);
                var typeOrderB = getPlanTypeOrder(b);

                if (typeOrderA !== typeOrderB) {
                    return typeOrderA - typeOrderB; // Ordenar por tipo
                } else {
                    var priceA = parseFloat(a.price.toString().replace(/[^0-9.]/g, ''));
                    var priceB = parseFloat(b.price.toString().replace(/[^0-9.]/g, ''));
                    return priceA - priceB; // Ordenar por precio si el tipo es el mismo
                }
            });

            plans.forEach(function (plan) {
                $plansResults.append(createPlanHTML(plan));
                console.log(plan);
            });
            showPlans();
        } else {
            // Si no se encuentran planes, mostrar mensaje
            $plansResults.append('<p>' + ep_ajax.no_planes + '</p>');
        }
    }

    // Función para crear el HTML de cada plan
    function createPlanHTML(plan) {
        // Aseguramos que los valores estén normalizados
        const connectivity5G = plan.connectivity_5g ? plan.connectivity_5g.toLowerCase().trim() : 'no';
        const connectivityLTE = plan.connectivity_lte ? plan.connectivity_lte.toLowerCase().trim() : 'no';

        // Determinar qué icono de conectividad mostrar
        let connectivityIcon = '';
        if (connectivity5G === 'yes') {
            connectivityIcon = ep_ajax.icon_url + '5Gread.svg';
        } else if (connectivityLTE === 'yes') {
            connectivityIcon = ep_ajax.icon_url + 'LTE.svg';
        } else {
            connectivityIcon = ep_ajax.icon_url + 'unknown.svg'; // Opcional: icono por defecto
        }

        // Asegurar que los valores sean números
        plan.data = parseInt(plan.data);
        plan.validity = parseInt(plan.validity);

        // Agregar clase según el tipo de plan
        let planTypeClass = '';
        if (plan.coverage_type === 'region') {
            planTypeClass = 'region-plan';
        } else if (plan.coverage_type === 'global') {
            planTypeClass = 'global-plan';
        }

        // Crear el HTML del plan
        return `
            <div class="mk-plan ${planTypeClass}">
                ${plan.coverage_type === 'region' ? `
                    <div class="region-title">
                        ${ep_ajax.plan_region}
                        <img src="${ep_ajax.icon_url}dropdown-icon.svg" alt="Desplegar" class="region-icon" />
                    </div>
                ` : ''}
                <div class="mk-network">
                    <img class="mk-flag" src="${plan.flag}" alt="${ep_ajax.bandera_de} ${plan.name}" />
                    <span class="mk-pais">${plan.name}</span>
                    ${connectivityIcon ? `<img class="mk-connectivity-icon" src="${connectivityIcon}" alt="Conectividad" />` : ''}
                </div>
                <div class="mk-datos">
                    <span class="mk-data">${plan.data} GB</span>
                    <span class="mk-divider">|</span>
                    <span class="mk-validity">${plan.validity} ${ep_ajax.dias}</span>
                </div>
                <div class="mk-precio">
                    <span class="mk-price">${plan.price} ${plan.currency}</span>
                </div>
                <div class="mk-boton">
                    <button class="mk-activate-button" data-product-id="${plan.product_id}">${ep_ajax.comprar}</button>
                </div>
                ${plan.coverage_type === 'region' ? `<div class="mk-coverage">${ep_ajax.paises_incluidos} ${plan.coverage || ''}</div>` : ''}
            </div>
        `;
    }

    // Función para mostrar los planes con transición
    function showPlans() {
        $('#mk-plans-results').addClass('visible').css({
            display: 'flex',
            opacity: '1',
            transform: 'translateY(0)'
        });
    }
});
