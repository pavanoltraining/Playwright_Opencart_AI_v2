import { test, expect } from '../../fixtures/pageFixtures';
import dotenv from 'dotenv';
import { RandomDataUtil } from '../../utils/dataGenerator';
import { executeQuery } from '../../utils/dbClient';

dotenv.config();

const APP_URL = process.env.WEB_APP_URL || 'http://localhost/opencart/upload/';
const ADMIN_URL = 'http://localhost/opencart/upload/admin/index.php';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const EXPECTED_STATUS = 1;

test('Customer registration validation across UI, Admin, and MySQL @master @regression @db @end-to-end', async ({
    page,
    homePage,
    registerPage,
    successPage,
    adminLoginPage,
    adminCustomersPage,
    adminCustomerEditPage,
}) => {
    const firstName = RandomDataUtil.getFirstName();
    const lastName = RandomDataUtil.getLastName();
    const uniqueKey = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${uniqueKey}@example.com`;
    const telephone = RandomDataUtil.getPhoneNumber().replace(/\D/g, '').slice(0, 12) || '1234567890';
    const password = RandomDataUtil.getPassword(12);

    await test.step('1) Register a customer through the frontend', async () => {
        await homePage.navigateTo(APP_URL);
        await homePage.clickMyAccount();
        await homePage.clickRegister();

        const isRegisterPage = await registerPage.isRegisterPageExists();
        expect(isRegisterPage, 'Register page should be displayed').toBeTruthy();

        await registerPage.completeRegistration(firstName, lastName, email, telephone, password);

        const isSuccessPageVisible = await successPage.isSuccessPageExists();
        expect(isSuccessPageVisible, 'Success page should be displayed after registration').toBeTruthy();

        const successText = await successPage.getSuccessHeadingText();
        expect(successText, 'Expected account creation confirmation message').toContain('Your Account Has Been Created!');

        await successPage.clickContinue();
    });

    await test.step('2) Verify the customer in the admin portal', async () => {
        await page.goto(ADMIN_URL);

        const isAdminLoginPage = await adminLoginPage.isAdminLoginPageExists();
        expect(isAdminLoginPage, 'Admin login page should be displayed').toBeTruthy();

        await adminLoginPage.login(ADMIN_USERNAME, ADMIN_PASSWORD);
        await adminCustomersPage.dismissSecurityModal();

        const currentUrl = new URL(page.url());
        const userToken = currentUrl.searchParams.get('user_token');
        expect(userToken, 'Admin user_token should be present after login').toBeTruthy();

        await page.goto(`${ADMIN_URL}?route=customer/customer&user_token=${userToken}`);
        await page.waitForLoadState('networkidle');

        await adminCustomersPage.searchCustomerByEmail(email);

        const customerRowExists = await adminCustomersPage.isCustomerRowExists(email);
        expect(customerRowExists, `Customer row for ${email} should be visible in the admin customer list`).toBeTruthy();

        await adminCustomersPage.clickEditCustomer(email);

        const isEditPageVisible = await adminCustomerEditPage.isEditCustomerPageExists();
        expect(isEditPageVisible, 'Customer edit page should open for the created customer').toBeTruthy();

        const adminFirstName = (await adminCustomerEditPage.getFirstNameValue()).trim();
        const adminLastName = (await adminCustomerEditPage.getLastNameValue()).trim();
        const adminEmail = (await adminCustomerEditPage.getEmailValue()).trim();
        const adminStatus = (await adminCustomerEditPage.getStatusValue()).trim();

        expect(adminFirstName, `Admin first name mismatch for ${email}`).toBe(firstName);
        expect(adminLastName, `Admin last name mismatch for ${email}`).toBe(lastName);
        expect(adminEmail, `Admin email mismatch for ${email}`).toBe(email);
        expect(adminStatus, `Admin status should be enabled for ${email}`).toBe(String(EXPECTED_STATUS));
    });

    await test.step('3) Verify the customer in MySQL', async () => {
        const records = await executeQuery(
            'SELECT firstname, lastname, email, status, date_added FROM oc_customer WHERE email = ? LIMIT 1',
            [email]
        );

        expect(Array.isArray(records), 'Database query should return an array of customer records').toBeTruthy();
        expect((records as Array<Record<string, unknown>>).length, `Expected exactly one customer row for ${email} in oc_customer`).toBe(1);

        const customer = (records as Array<Record<string, unknown>>)[0];

        expect(String(customer.firstname ?? ''), `DB firstname mismatch for ${email}`).toBe(firstName);
        expect(String(customer.lastname ?? ''), `DB lastname mismatch for ${email}`).toBe(lastName);
        expect(String(customer.email ?? ''), `DB email mismatch for ${email}`).toBe(email);
        expect(Number(customer.status), `DB status mismatch for ${email}`).toBe(EXPECTED_STATUS);

        if ('date_added' in customer) {
            expect(String(customer.date_added ?? ''), `DB date_added should be populated for ${email}`).not.toBe('');
        }
    });

    console.log(`✅ Customer validation for ${email} passed across the UI, Admin, and MySQL.`);
});
