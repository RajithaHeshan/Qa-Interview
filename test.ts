import { Selector } from 'testcafe';
import faker from 'faker';

fixture`Sauce Demo Test`
    .page`https://www.saucedemo.com`
    .beforeEach(async t => {
        // login before each test
        await t
            .typeText('#user-name', 'performance_glitch_user')
            .typeText('#password', 'secret_sauce')
            .click('#login-button');
    });

class ProductsPage {
    public productTitle = Selector('.inventory_item_name');
    public addToCartButton = Selector('.btn_inventory');
    public cartIcon = Selector('.shopping_cart_link');
}

class CartPage {
    public cartItemName = Selector('.inventory_item_name');
    public checkoutButton = Selector('.checkout_button');
}

class CheckoutPage {
    public firstNameField = Selector('#first-name');
    public lastNameField = Selector('#last-name');
    public zipCodeField = Selector('#postal-code');
    public continueButton = Selector('.checkout_buttons').child(0);
    public finishButton = Selector('.checkout_button');
}

test('Add products to cart and checkout', async t => {
    const productsPage = new ProductsPage();
    const cartPage = new CartPage();
    const checkoutPage = new CheckoutPage();

    // verify price of product
    const productTitle = await productsPage.productTitle.withText('Sauce Labs Fleece Jacket');
    const productPrice = await productTitle.sibling('.inventory_item_price').innerText;
    await t.expect(productPrice).eql('$49.99');

    // add two products to cart
    const product1 = await productsPage.productTitle.nth(0).innerText;
    const product2 = await productsPage.productTitle.nth(2).innerText;
    await t
        .click(productsPage.addToCartButton.nth(0))
        .click(productsPage.addToCartButton.nth(2));

    // go to cart and verify selected items
    await t
        .click(productsPage.cartIcon)
        .expect(cartPage.cartItemName.withText(product1).exists).ok()
        .expect(cartPage.cartItemName.withText(product2).exists).ok();

    // checkout
    await t
        .click(cartPage.checkoutButton)
        .typeText(checkoutPage.firstNameField, faker.name.firstName())
        .typeText(checkoutPage.lastNameField, faker.name.lastName())
        .typeText(checkoutPage.zipCodeField, faker.address.zipCode())
        .click(checkoutPage.continueButton)
        .click(checkoutPage.finishButton);

    // verify successful checkout
    const successMessage = Selector('.complete-header').innerText;
    await t.expect(successMessage).eql('THANK YOU FOR YOUR ORDER');
});
