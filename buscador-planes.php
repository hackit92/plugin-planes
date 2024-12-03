<?php
// wp-content/plugins/buscador-planes/buscador-planes.php
/**
 * Plugin Name: eSIM Plans Widget
 * Description: Un widget para buscar y mostrar planes eSIM según el país.
 * Version: 1.0
 * Author: Abraham F
 * Text Domain: esim-plans-widget
 * Domain Path: /languages
 */

defined('ABSPATH') or die('No script kiddies please!');

/**
 * Verificar si WooCommerce está activo.
 */
function ep_check_woocommerce_active() {
    if ( ! in_array( 'woocommerce/woocommerce.php', apply_filters( 'active_plugins', get_option( 'active_plugins' ) ) ) ) {
        add_action('admin_notices', 'ep_woocommerce_not_active_notice');
        return false;
    }
    return true;
}
if ( ! ep_check_woocommerce_active() ) {
    // Detener la ejecución del plugin si WooCommerce no está activo.
    return;
}

/**
 * Mostrar un mensaje de error si WooCommerce no está activo.
 */
function ep_woocommerce_not_active_notice() {
    echo '<div class="error"><p>' . esc_html__('eSIM Plans Widget requiere que WooCommerce esté activo.', 'esim-plans-widget') . '</p></div>';
}

/**
 * Cargar traducciones.
 */
function ep_cargar_traducciones() {
    load_plugin_textdomain('esim-plans-widget', false, dirname(plugin_basename(__FILE__)) . '/languages/');
}
add_action('plugins_loaded', 'ep_cargar_traducciones');


// Obtener las categorías de WooCommerce y sus slugs (formato ISO3)
function ep_get_iso3_categories() {
    if (class_exists('WooCommerce')) {
        // Obtener IDs de productos publicados y visibles
        $args = array(
            'status'    => 'publish',
            'limit'     => -1,
            'return'    => 'ids',
            'visibility' => 'catalog', // Solo productos visibles en el catálogo
        );
        $product_ids = wc_get_products($args);

        if (empty($product_ids)) {
            error_log('No se encontraron productos publicados y visibles.');
            return array();
        }

        // Obtener las categorías asociadas a estos productos
        $terms = wp_get_object_terms($product_ids, 'product_cat', array('fields' => 'slugs'));

        if (is_wp_error($terms)) {
            error_log('Error al obtener las categorías de productos: ' . $terms->get_error_message());
            return array();
        }

        // Eliminar duplicados y asegurar que los slugs estén en minúsculas
        $iso3_categories = array_unique(array_map('strtolower', $terms));

        // Para depuración
        error_log('Categorías ISO3 obtenidas con productos publicados y visibles: ' . print_r($iso3_categories, true));

        return $iso3_categories;
    } else {
        error_log('WooCommerce no está activo.');
    }
    return array();
}

global $iso3_categories; // Usar la variable global

/**
 * Encolar scripts y estilos.
 */
function ep_enqueue_scripts() {
    // Encolar jQuery y jQuery UI Autocomplete
    wp_enqueue_script('jquery');
    wp_enqueue_script('jquery-ui-autocomplete');

    // Encolar estilos de jQuery UI
    wp_enqueue_style('jquery-ui-css', 'https://code.jquery.com/ui/1.12.1/themes/base/jquery-ui.css');

    // Encolar estilos y scripts de Select2
    wp_enqueue_style('select2-css', 'https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css', array(), '4.1.0');
    wp_enqueue_script('select2-js', 'https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js', array('jquery'), '4.1.0', true);

    // Encolar tus estilos personalizados
    wp_enqueue_style('ep-styles', plugin_dir_url(__FILE__) . 'css/styles.css', array(), '1.0');
    wp_enqueue_script('ep-script', plugin_dir_url(__FILE__) . 'js/script.js', array('jquery', 'jquery-ui-autocomplete', 'select2-js'), '1.0', true);

    // Localizar script con datos necesarios y nonce para seguridad
    wp_localize_script('ep-script', 'ep_ajax', array(
        'ajax_url' => admin_url('admin-ajax.php'),
        'countries' => ep_get_countries(),
        'icon_url' => plugin_dir_url(__FILE__) . 'assets/icons/',
        'checkout_url' => wc_get_checkout_url(),
        'paises_incluidos' => __('Cobertura en: ', 'esim-plans-widget'),
        'plan_region' => __('Plan Regional', 'esim-plans-widget'),
        'bandera_de' => __('Bandera de', 'esim-plans-widget'),
        'comprar' => __('Comprar', 'esim-plans-widget'),
        'cargando' => __('Cargando...', 'esim-plans-widget'),
        'no_planes' => __('No se encontraron planes.', 'esim-plans-widget'),
        'ingresar_pais' => __('Por favor, ingresa un país válido.', 'esim-plans-widget'),
        'dias' => __('días', 'esim-plans-widget'),
        'wc_categories' => ep_get_iso3_categories(),
        'error' => __('Ocurrió un error. Por favor, inténtalo de nuevo.', 'esim-plans-widget'),
        'nonce' => wp_create_nonce('ep_ajax_nonce'),
    ));
}
add_action('wp_enqueue_scripts', 'ep_enqueue_scripts');
/**
 * Obtener países con variantes de nombres desde el archivo paises.php.
 * 
 * @return array Lista de países con variantes de nombres (nombre variante => código).
 */
function ep_get_countries() {
    $countries = include(plugin_dir_path(__FILE__) . 'paises.php'); // Cargar países desde el archivo paises.php
    $flattened_countries = array();

    foreach ($countries as $code => $names) {
        foreach ($names as $name) {
            $flattened_countries[$name] = strtolower($code); // Usar minúsculas para coincidir con slugs
        }
    }

    return $flattened_countries;
}

/**
 * Renderizar el widget mediante shortcode.
 * 
 * @return string HTML del widget.
 */
function ep_render_widget() {
    ob_start(); ?>
    <div class="mk-widget-container">
        <!-- Encabezado del widget -->
        <div class="mk-widget-header">
            <div class="mk-input-container">
                <input type="text" id="mk-destination" placeholder="Buscar país..." autocomplete="off">
                <span class="mk-location-icon"><i class="fas fa-map-marker-alt"></i></span>
                <input type="hidden" id="country_code">
                <!-- Contenedor para las sugerencias de autocompletado -->
                <div id="country-suggestions" class="autocomplete-suggestions"></div>
            </div>
        </div>

        <!-- Contenedor de pestañas -->
        <div class="mk-tab-container">
            <ul class="mk-tabs">
                <li class="mk-tab" data-tab-target="#countries-list">Países</li>
                <li class="mk-tab" data-tab-target="#regions-list">Regiones</li>
            </ul>
        </div>

        <!-- Contenedor para el listado de países -->
        <div id="countries-list" class="filter-list"></div>
        <!-- Contenedor para la paginación de países -->
        <div id="countries-pagination"></div>

        <!-- Contenedor para el listado de regiones -->
        <div id="regions-list" class="filter-list"></div>

        <!-- Contenedor para resultados de planes -->
        <div class="mk-plans-header" style="display: none;">
        <!-- Contenedor para toggle-->
        <button id="filter-toggle-button" class="filter-toggle-button">
        Filtrar
        <span class="filter-toggle-icon">&#9660;</span>
        </button>
            <!-- Contenedor para los filtros -->
            <div id="mk-filters">
                <!-- Filtro: Duración -->
                <div class="mk-filter-group">
                    <label class="filter-title">Duración (días)</label>
                    <div class="filter-tabs" id="filter-duration">
                        <button class="filter-tab" data-value="5">5</button>
                        <button class="filter-tab" data-value="10">10</button>
                        <button class="filter-tab" data-value="15">15</button>
                        <button class="filter-tab" data-value="30">30</button>
                    </div>
                </div>

                <!-- Filtro: Datos -->
                <div class="mk-filter-group">
                    <label class="filter-title">Datos (GB)</label>
                    <div class="filter-tabs" id="filter-data">
                        <button class="filter-tab" data-value="1">1</button>
                        <button class="filter-tab" data-value="3">3</button>
                        <button class="filter-tab" data-value="5">5</button>
                        <button class="filter-tab" data-value="10">10</button>
                        <button class="filter-tab" data-value="20">20</button>
                    </div>
                </div>

                <!-- Filtro: Tipo de Plan -->
                <div class="mk-filter-group">
                    <label class="filter-title">Tipo de Plan</label>
                    <div class="filter-tabs" id="filter-planType">
                        <button class="filter-tab" data-value="local">Local</button>
                        <button class="filter-tab" data-value="region">Regional</button>
                        <button class="filter-tab" data-value="global">Global</button>
                    </div>
                </div>

                <!-- Botones de acción -->
                <div class="mk-filter-buttons">
                    <button id="reset-filters" class="mk-filter-button-icon" data-tooltip="Restablecer">
                        <i class="fas fa-sync"></i>
                    </button>
                </div>
            </div>

            <h3>Planes Disponibles</h3>
        </div>
        <div id="mk-plans-results" class="mk-plans"></div>
    </div>

    <?php
    return ob_get_clean();
}

add_shortcode('esim_plans_widget', 'ep_render_widget');

/**
 * Manejar la búsqueda de planes via AJAX.
 */
function ep_search_plans() {
    // Verificar nonce para seguridad
    if ( ! isset($_POST['nonce']) || ! wp_verify_nonce($_POST['nonce'], 'ep_ajax_nonce') ) {
        wp_send_json_error(__('Nonce de seguridad no válido.', 'esim-plans-widget'));
    }

    // Obtener y sanitizar los datos enviados
    $country_code = isset($_POST['country_code']) ? sanitize_text_field($_POST['country_code']) : '';
    $region_slug = isset($_POST['region_slug']) ? sanitize_text_field($_POST['region_slug']) : '';
    $plan_type = isset($_POST['plan_type']) ? sanitize_text_field($_POST['plan_type']) : '';

    if ( empty($country_code) && empty($region_slug) ) {
        wp_send_json_error(__('Código de país o slug de región no proporcionado.', 'esim-plans-widget'));
    }

    // Incluir el archivo de países
    $countries = include(plugin_dir_path(__FILE__) . 'paises.php');

    // Definir argumentos básicos para la consulta de productos
    $args = array(
        'post_type' => 'product',
        'posts_per_page' => -1,
        'orderby' => 'meta_value_num', // Ordenar por valor numérico de un campo meta
        'order' => 'ASC', // Orden ascendente
        'post_status' => 'publish', // Incluir solo productos publicados
        'suppress_filters' => false, // Asegurar que se apliquen los filtros
    );

        // Inicializar meta_query y tax_query
    $meta_query = array();
    $tax_query = array();


    // Determinar si estamos buscando por país o región
    if ( ! empty($country_code) ) {
        // Si se busca por país, utilizar `tax_query` para filtrar por la categoría del país
        $args['tax_query'] = array(
            array(
                'taxonomy' => 'product_cat',
                'field'    => 'slug',
                'terms'    => strtolower($country_code), // Convertir a minúsculas para que coincida con los slugs de las categorías
                'operator' => 'IN',
            ),
        );
    } elseif ( ! empty($region_slug) ) {
        // Si se busca por región, aplicar filtro `posts_where` para coincidir con slugs de productos
        add_filter('posts_where', function ($where, $query) use ($region_slug) {
            global $wpdb;

            // Crear un patrón REGEXP para buscar slugs que comiencen con `region_slug` y variaciones como `-2, -3`
            $slug_pattern = '^' . $wpdb->esc_like($region_slug) . '(-[0-9]+)?$';

            // Modificar la consulta para buscar slugs que coincidan con el patrón
            $where .= $wpdb->prepare(" AND {$wpdb->posts}.post_name REGEXP %s", $slug_pattern);

            return $where;
        }, 10, 2);
    }

      // Agregar 'plan_type' al meta_query
    if ( ! empty($plan_type) ) {
        $meta_query[] = array(
            'key'     => '_coverage', // Asegúrate de que este sea el nombre correcto del metacampo
            'value'   => strtolower($plan_type), // Convertir a minúsculas para coincidir con los valores en el metacampo
            'compare' => '='
        );
    }
   if ( ! empty($meta_query) ) {
        $args['meta_query'] = $meta_query;
    }

    if ( ! empty($tax_query) ) {
        $args['tax_query'] = $tax_query;
    }


    // Ejecutar la consulta y obtener los productos
    $query = new WP_Query($args);

    $results = array();

    foreach ($query->posts as $product) {
        // Obtener el objeto WC_Product
        $product_obj = wc_get_product($product->ID);

        if (!$product_obj) {
            continue; // Si no se puede obtener el producto, continuar al siguiente
        }

        $price = $product_obj->get_price(); // Obtener el precio

        // Recuperar los metadatos de conectividad
        $connectivity_5g_raw = get_post_meta($product->ID, '_connectivity_5g', true);
        $connectivity_lte_raw = get_post_meta($product->ID, '_connectivity_lte', true);

        // Normalizar los valores (convertir a minúsculas y eliminar espacios)
        $connectivity_5g = strtolower(trim($connectivity_5g_raw));
        $connectivity_lte = strtolower(trim($connectivity_lte_raw));

        // Asegurarse de que los valores sean 'yes' o 'no'
        $connectivity_5g = ($connectivity_5g === 'yes') ? 'yes' : 'no';
        $connectivity_lte = ($connectivity_lte === 'yes') ? 'yes' : 'no';

        // Obtener los nombres de los países en español (en caso de necesitarse)
        $coverage_names = array();
        $categories = wp_get_post_terms($product->ID, 'product_cat', array('fields' => 'slugs'));

        foreach ($categories as $category_slug) {
            // Convertir el slug a mayúsculas para la comparación
            $upper_slug = strtoupper($category_slug);

            // Buscar el código ISO3 correspondiente al slug de la categoría
            if (array_key_exists($upper_slug, $countries)) {
                // Agregar solo el primer nombre del país en español
                $coverage_names[] = $countries[$upper_slug][0]; // Solo el primer nombre
            }
        }

       // Obtener el valor del metacampo '_coverage'
        $coverage_type = get_post_meta($product->ID, '_coverage', true);

        // Normalizar el valor y asegurarse de que sea 'local', 'region' o 'global'
        $coverage_type = strtolower(trim($coverage_type));

        if (!in_array($coverage_type, ['local', 'region', 'global'])) {
            $coverage_type = 'local'; // Valor por defecto si no coincide
        }

        // Establecer los indicadores de tipo de plan
        $is_local = ($coverage_type === 'local');
        $is_region = ($coverage_type === 'region');
        $is_global = ($coverage_type === 'global');

        // Si aún utilizas la variable $is_regional en otras partes del código, puedes actualizarla así:
        $is_regional = $is_region; // Para mantener compatibilidad

        // Asignar la URL de la bandera
        $flag_url = '';
        if ( ! empty($country_code) ) {
            // Si es un país específico, usar el código de país para el icono
            $flag_url = esc_url(plugin_dir_url(__FILE__) . 'assets/icons/' . strtolower($country_code) . '.svg');
        } elseif ( ! empty($region_slug) ) {
            // Si es una región, usar el slug de la región para el icono o asignar un icono por defecto
            $flag_url = esc_url(plugin_dir_url(__FILE__) . 'assets/icons/' . strtolower($region_slug) . '.svg');

            // Si no existe un archivo SVG para la región, usar un icono por defecto
            $default_region_icon = esc_url(plugin_dir_url(__FILE__) . 'assets/icons/region.svg');
            if (!file_exists(plugin_dir_path(__FILE__) . 'assets/icons/' . strtolower($region_slug) . '.svg')) {
                $flag_url = $default_region_icon; // Asignar el icono por defecto
            }
        }

        // Crear el resultado del producto
        $results[] = array(
            'flag' => $flag_url, // Usar el icono de la región o país
            'name' => esc_html($product->post_title),
            'connectivity_5g' => $connectivity_5g,
            'connectivity_lte' => $connectivity_lte,
            'data' => esc_html(get_post_meta($product->ID, '_data_quota_gb', true)),
            'validity' => esc_html(get_post_meta($product->ID, '_validity_days', true)),
            'price' => wc_price($price),
            'currency' => esc_html(get_woocommerce_currency()),
            'buy_link' => esc_url(get_permalink($product->ID)),
            'coverage' => implode(', ', $coverage_names), // Unir los nombres de los países
            'coverage_type' => $coverage_type, // Tipo de cobertura (local, regional, global)
            'is_local' => $is_local,
            'is_regional' => $is_regional,
            'is_global' => $is_global,
            'product_id' => intval($product->ID),
        );
    }
      // Eliminar el filtro posts_where para no afectar otras consultas
    remove_all_filters('posts_where');
    
    // Enviar la respuesta con los productos encontrados
    wp_send_json(array('success' => true, 'data' => $results));
}

add_action('wp_ajax_ep_search_plans', 'ep_search_plans');
add_action('wp_ajax_nopriv_ep_search_plans', 'ep_search_plans');

/**
 * Manejar la adición de productos al carrito y redirección al checkout via AJAX.
 */
function ep_add_to_cart() {
    // Verificar nonce para seguridad
    if ( ! isset($_POST['nonce']) || ! wp_verify_nonce($_POST['nonce'], 'ep_ajax_nonce') ) {
        wp_send_json_error(__('Nonce de seguridad no válido.', 'esim-plans-widget'));
    }

    // Verificar si se proporciona el ID del producto
    if (!isset($_POST['product_id'])) {
        wp_send_json_error(__('ID de producto no proporcionado.', 'esim-plans-widget'));
    }

    $product_id = intval($_POST['product_id']);

    // Validar que el producto existe y es de tipo 'product'
    if ( !$product_id || get_post_type($product_id) !== 'product' ) {
        wp_send_json_error(__('Producto no válido.', 'esim-plans-widget'));
    }

    // Verificar si WooCommerce está activo
    if ( ! function_exists('WC') ) {
        wp_send_json_error(__('WooCommerce no está activo.', 'esim-plans-widget'));
    }

    // Añadir el producto al carrito
    $added = WC()->cart->add_to_cart($product_id);

    if ($added) {
        wp_send_json_success();
    } else {
        wp_send_json_error(__('No se pudo añadir el producto al carrito.', 'esim-plans-widget'));
    }
}
add_action('wp_ajax_ep_add_to_cart', 'ep_add_to_cart');
add_action('wp_ajax_nopriv_ep_add_to_cart', 'ep_add_to_cart');
