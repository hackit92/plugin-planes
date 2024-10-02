<?php
/**
 * Plugin Name: eSIM Plans Widget
 * Description: A widget to search and display eSIM plans based on country.
 * Version: 1.0
 * Author: Your Name
 */

defined('ABSPATH') or die('No script kiddies please!');
function cargar_traducciones() {
    load_plugin_textdomain('eSIM Plans Widget', false, dirname(plugin_basename(__FILE__)) . '/languages/');
}
add_action('plugins_loaded', 'cargar_traducciones');

function ep_enqueue_scripts() {
    // Cargar jQuery
    wp_enqueue_script('jquery');

    // Cargar jQuery UI
    wp_enqueue_script('jquery-ui-autocomplete');
    wp_enqueue_style('jquery-ui-css', 'https://code.jquery.com/ui/1.12.1/themes/base/jquery-ui.css');

    // Cargar estilos y scripts personalizados
    wp_enqueue_style('ep-styles', plugin_dir_url(__FILE__) . 'css/styles.css', array(), '1.0');
    wp_enqueue_script('ep-script', plugin_dir_url(__FILE__) . 'js/script.js', array('jquery', 'jquery-ui-autocomplete'), '1.0', true);

     // Localizar script
    wp_localize_script('ep-script', 'ep_ajax', array(
        'ajax_url' => admin_url('admin-ajax.php'),
        'countries' => ep_get_countries(),
        'icon_url' => plugin_dir_url(__FILE__) . 'assets/icons/' // Agrega la ruta base de los íconos
    ));
}
add_action('wp_enqueue_scripts', 'ep_enqueue_scripts');

function ep_get_countries() {
    // Cargar la relación de países y códigos desde el archivo
    $countries = include(plugin_dir_path(__FILE__) . 'paises.php');
    
    return $countries; // Retornar el array de países
}

function ep_render_widget() {
    ob_start(); ?>
    <div class="mk-widget-container">
        <div class="mk-widget-header">
            <div class="mk-destination">
                <div class="mk-input-container">
                    <span class="mk-location-icon">
                        <img class="mk-flag" src="<?php echo plugin_dir_url(__FILE__) . 'assets/icons/location.svg'; ?>" />
                    </span>
                    <input type="text" id="mk-destination" placeholder="Buscar País" />
                    <input type="hidden" id="country_code" /> <!-- Campo oculto para el código de país -->
                </div>
            </div>
            <button class="mk-search-button">Buscar Planes</button>
        </div>

        <h2 class="mk-plans-header" style="display: none;">Mejores Planes</h2>

        <div class="mk-plans" id="mk-plans-results"></div>
    </div>
    <?php
    return ob_get_clean();
}
add_shortcode('esim_plans_widget', 'ep_render_widget');

// Maneja la búsqueda de planes
function ep_search_plans() {
    $country_code = sanitize_text_field($_POST['country_code']);
    
    // Busca en productos de WooCommerce que pertenecen a la categoría del país
    $args = array(
        'post_type' => 'product',
        'posts_per_page' => -1,
        'tax_query' => array(
            array(
                'taxonomy' => 'product_cat',
                'field'    => 'slug',
                'terms'    => strtolower($country_code),
            ),
        ),
    );

    $products = get_posts($args);
    $results = array();

    foreach ($products as $product) {
        $data_quota_gb = get_post_meta($product->ID, '_data_quota_gb', true);
        $validity_days = get_post_meta($product->ID, '_validity_days', true);
        $price = get_post_meta($product->ID, '_price', true);
        $currency = get_post_meta($product->ID, '_currency', true);

        // Obtener las categorías del producto
        $categories = wp_get_post_terms($product->ID, 'product_cat', array('fields' => 'names')); // Obtener nombres de las categorías

        $results[] = array(
            'flag' => plugin_dir_url(__FILE__) . 'assets/icons/' . strtolower($country_code) . '.svg',
            'name' => $product->post_title,
            'connectivity' => get_post_meta($product->ID, '_connectivity', true),
            'data' => $data_quota_gb,
            'validity' => $validity_days,
            'price' => $price,
            'currency' => $currency,
            'buy_link' => get_permalink($product->ID),
            'categories' => $categories // Añadir categorías al resultado
        );
    }

    wp_send_json($results);
}

add_action('wp_ajax_ep_search_plans', 'ep_search_plans');
add_action('wp_ajax_nopriv_ep_search_plans', 'ep_search_plans');
