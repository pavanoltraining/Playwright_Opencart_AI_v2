import { test, expect } from '@playwright/test';
import Ajv from 'ajv';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { Routes } from '../../api/endpoints/routes';
import { DataProvider } from '../../utils/DataReader';
import { RandomDataUtil } from '../../utils/dataGenerator';

const envPath = path.resolve(__dirname, '..', '..', '.env');
const projectEnv = fs.existsSync(envPath)
    ? { ...process.env, ...dotenv.parse(fs.readFileSync(envPath, 'utf8')) }
    : process.env;

const BASE_URL = projectEnv.API_BASE_URL || Routes.BASE_URL;
const PRODUCT_ID = Number(projectEnv.PRODUCT_ID ?? 1);
const USER_ID = Number(projectEnv.USER_ID ?? 1);
const CART_ID = Number(projectEnv.CART_ID ?? 1);
const LIMIT = Number(projectEnv.LIMIT ?? 3);
const START_DATE = projectEnv.START_DATE ?? '2019-12-10';
const END_DATE = projectEnv.END_DATE ?? '2020-10-10';
const USERNAME = projectEnv.USERNAME ?? 'mor_2314';
const PASSWORD = projectEnv.PASSWORD ?? '83r5^_';

const replaceRouteParams = (route: string, values: Record<string, string | number>): string => {
    let resolvedRoute = route;
    for (const [key, value] of Object.entries(values)) {
        resolvedRoute = resolvedRoute.replace(`{${key}}`, String(value));
    }
    return resolvedRoute;
};

const validateSchema = (payload: unknown, schemaFileName: string): void => {
    const schemaPath = path.resolve(__dirname, '..', '..', 'api', 'schemas', schemaFileName);
    const schema = DataProvider.readJson(schemaPath);
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(schema);
    const isValid = validate(payload);

    expect(isValid, `Schema validation failed for ${schemaFileName}: ${ajv.errorsText(validate.errors)}`).toBeTruthy();
};

const getIdList = (records: Array<{ id: number }>): number[] => records.map((record) => record.id);
const getCartIdList = (records: Array<{ id: number }>): number[] => records.map((record) => record.id);

const getStatusText = async (response: any): Promise<string> => {
    return response.text();
};

test.describe('FakeStore API Tests', () => {
    test('POST - Successful login @master @sanity @api', async ({ request }) => {
        const response = await request.post(`${BASE_URL}${Routes.AUTH_LOGIN}`, {
            data: {
                username: USERNAME,
                password: PASSWORD,
            },
        });

        expect(response.status(), 'Expected status 201 for successful login').toBe(201);

        const body = await response.json();

        expect(body, 'Login response should be an object').toBeTruthy();
        expect(body.token, 'Token property should exist in the login response').toBeTruthy();
        expect(typeof body.token, 'Token should be a non-empty string').toBe('string');
        expect(body.token.length, 'Token should not be empty').toBeGreaterThan(0);
    });

    test('POST - Invalid login @master @regression @api', async ({ request }) => {
        const response = await request.post(`${BASE_URL}${Routes.AUTH_LOGIN}`, {
            data: {
                username: 'invalid_user',
                password: 'invalid_password',
            },
        });

        expect(response.status(), 'Expected status 401 for invalid login').toBe(401);

        const body = await response.text();
        expect(body, 'Expected invalid login error message').toBe('username or password is incorrect');
    });

    test('GET - All products @master @sanity @api', async ({ request }) => {
        const response = await request.get(`${BASE_URL}${Routes.GET_ALL_PRODUCTS}`);

        expect(response.status(), 'Expected status 200 for all products request').toBe(200);

        const body = await response.json();
        expect(Array.isArray(body), 'Response should be an array').toBeTruthy();
        expect(body.length, 'Product array should not be empty').toBeGreaterThan(0);

        const firstProduct = body[0];
        expect(firstProduct).toHaveProperty('id');
        expect(firstProduct).toHaveProperty('title');
        expect(firstProduct).toHaveProperty('price');
        expect(firstProduct).toHaveProperty('category');
        expect(firstProduct).toHaveProperty('image');
    });

    test('GET - Product by ID @master @sanity @api', async ({ request }) => {
        const route = replaceRouteParams(Routes.GET_PRODUCT_BY_ID, { id: PRODUCT_ID });
        const response = await request.get(`${BASE_URL}${route}`);

        expect(response.status(), 'Expected status 200 for get product by ID').toBe(200);

        const body = await response.json();
        expect(body.id, 'Returned product ID should match requested ID').toBe(PRODUCT_ID);
        expect(body).toHaveProperty('title');
        expect(body).toHaveProperty('price');
        expect(body).toHaveProperty('category');
        expect(body).toHaveProperty('image');
    });

    test('GET - Products with limit @master @regression @api', async ({ request }) => {
        const route = replaceRouteParams(Routes.GET_PRODUCTS_WITH_LIMIT, { limit: LIMIT });
        const response = await request.get(`${BASE_URL}${route}`);

        expect(response.status(), 'Expected status 200 for products with limit').toBe(200);

        const body = await response.json();
        expect(Array.isArray(body), 'Response should be an array').toBeTruthy();
        expect(body.length, `Expected exactly ${LIMIT} product records`).toBe(LIMIT);
    });

    test('GET - Products sorted ascending @master @regression @api', async ({ request }) => {
        const route = replaceRouteParams(Routes.GET_PRODUCTS_SORTED, { order: 'asc' });
        const response = await request.get(`${BASE_URL}${route}`);

        expect(response.status(), 'Expected status 200 for ascending product sort').toBe(200);

        const body = await response.json();
        expect(Array.isArray(body), 'Response should be an array').toBeTruthy();
        const ids = getIdList(body);
        expect(ids.every((id, index, array) => index === 0 || array[index - 1] <= id), 'Product IDs should be sorted ascending').toBeTruthy();
    });

    test('GET - Products sorted descending @master @regression @api', async ({ request }) => {
        const route = replaceRouteParams(Routes.GET_PRODUCTS_SORTED, { order: 'desc' });
        const response = await request.get(`${BASE_URL}${route}`);

        expect(response.status(), 'Expected status 200 for descending product sort').toBe(200);

        const body = await response.json();
        expect(Array.isArray(body), 'Response should be an array').toBeTruthy();
        const ids = getIdList(body);
        expect(ids.every((id, index, array) => index === 0 || array[index - 1] >= id), 'Product IDs should be sorted descending').toBeTruthy();
    });

    test('GET - All product categories @master @sanity @api', async ({ request }) => {
        const response = await request.get(`${BASE_URL}${Routes.GET_ALL_CATEGORIES}`);

        expect(response.status(), 'Expected status 200 for all categories request').toBe(200);

        const body = await response.json();
        expect(Array.isArray(body), 'Response should be an array').toBeTruthy();
        expect(body.length, 'Category list should not be empty').toBeGreaterThan(0);
    });

    test('GET - Products by category @master @regression @api', async ({ request }) => {
        const route = replaceRouteParams(Routes.GET_PRODUCTS_BY_CATEGORY, { category: 'electronics' });
        const response = await request.get(`${BASE_URL}${route}`);

        expect(response.status(), 'Expected status 200 for category products request').toBe(200);

        const body = await response.json();
        expect(Array.isArray(body), 'Response should be an array').toBeTruthy();
        expect(body.length, 'Electronics category should return products').toBeGreaterThan(0);

        for (const product of body) {
            expect(product.category, 'Each returned product should match the category filter').toBe('electronics');
        }
    });

    test('POST - Create product @master @regression @api', async ({ request }) => {
        const payload = RandomDataUtil.generateProductPayload();
        const response = await request.post(`${BASE_URL}${Routes.CREATE_PRODUCT}`, { data: payload });

        expect(response.status(), 'Expected status 201 when creating a product').toBe(201);

        const body = await response.json();
        expect(body.id, 'Created product should include a generated ID').toBeTruthy();
        expect(body.title, 'Created product title should match payload').toBe(payload.title);
        expect(body.price, 'Created product price should match payload').toBe(payload.price);
        expect(body.description, 'Created product description should match payload').toBe(payload.description);
        expect(body.category, 'Created product category should match payload').toBe(payload.category);
    });

    test('PUT - Update product @master @regression @api', async ({ request }) => {
        const route = replaceRouteParams(Routes.UPDATE_PRODUCT, { id: PRODUCT_ID });
        const payload = RandomDataUtil.generateUpdatedProductPayload();
        const response = await request.put(`${BASE_URL}${route}`, { data: payload });

        expect(response.status(), 'Expected status 200 when updating a product').toBe(200);

        const body = await response.json();
        expect(body.id, 'Updated product ID should match requested ID').toBe(PRODUCT_ID);
        expect(body.title, 'Updated product title should match payload').toBe(payload.title);
        expect(body.price, 'Updated product price should match payload').toBe(payload.price);
        expect(body.description, 'Updated product description should match payload').toBe(payload.description);
        expect(body.category, 'Updated product category should match payload').toBe(payload.category);
    });

    test('DELETE - Delete product @master @regression @api', async ({ request }) => {
        const route = replaceRouteParams(Routes.DELETE_PRODUCT, { id: PRODUCT_ID });
        const response = await request.delete(`${BASE_URL}${route}`);

        expect(response.status(), 'Expected status 200 when deleting a product').toBe(200);

        const body = await response.json();
        expect(body, 'Delete response body should be present').toBeTruthy();
    });

    test('GET - All users @master @sanity @api', async ({ request }) => {
        const response = await request.get(`${BASE_URL}${Routes.GET_ALL_USERS}`);

        expect(response.status(), 'Expected status 200 for all users request').toBe(200);

        const body = await response.json();
        expect(Array.isArray(body), 'Response should be an array').toBeTruthy();
        expect(body.length, 'User array should not be empty').toBeGreaterThan(0);
    });

    test('GET - User by ID @master @sanity @api', async ({ request }) => {
        const route = replaceRouteParams(Routes.GET_USER_BY_ID, { id: USER_ID });
        const response = await request.get(`${BASE_URL}${route}`);

        expect(response.status(), 'Expected status 200 for get user by ID').toBe(200);

        const body = await response.json();
        expect(body.id, 'Returned user ID should match requested ID').toBe(USER_ID);
        expect(body).toHaveProperty('email');
        expect(body).toHaveProperty('username');
        expect(body).toHaveProperty('name');
    });

    test('GET - Users with limit @master @regression @api', async ({ request }) => {
        const route = replaceRouteParams(Routes.GET_USERS_WITH_LIMIT, { limit: LIMIT });
        const response = await request.get(`${BASE_URL}${route}`);

        expect(response.status(), 'Expected status 200 for users with limit').toBe(200);

        const body = await response.json();
        expect(Array.isArray(body), 'Response should be an array').toBeTruthy();
        expect(body.length, `Expected exactly ${LIMIT} user records`).toBe(LIMIT);
    });

    test('GET - Users sorted ascending @master @regression @api', async ({ request }) => {
        const route = replaceRouteParams(Routes.GET_USERS_SORTED, { order: 'asc' });
        const response = await request.get(`${BASE_URL}${route}`);

        expect(response.status(), 'Expected status 200 for ascending user sort').toBe(200);

        const body = await response.json();
        expect(Array.isArray(body), 'Response should be an array').toBeTruthy();
        const ids = getIdList(body);
        expect(ids.every((id, index, array) => index === 0 || array[index - 1] <= id), 'User IDs should be sorted ascending').toBeTruthy();
    });

    test('GET - Users sorted descending @master @regression @api', async ({ request }) => {
        const route = replaceRouteParams(Routes.GET_USERS_SORTED, { order: 'desc' });
        const response = await request.get(`${BASE_URL}${route}`);

        expect(response.status(), 'Expected status 200 for descending user sort').toBe(200);

        const body = await response.json();
        expect(Array.isArray(body), 'Response should be an array').toBeTruthy();
        const ids = getIdList(body);
        expect(ids.every((id, index, array) => index === 0 || array[index - 1] >= id), 'User IDs should be sorted descending').toBeTruthy();
    });

    test('POST - Create user @master @regression @api', async ({ request }) => {
        const payload = RandomDataUtil.generateUserPayload();
        const response = await request.post(`${BASE_URL}${Routes.CREATE_USER}`, { data: payload });

        expect(response.status(), 'Expected status 201 when creating a user').toBe(201);

        const body = await response.json();
        expect(body.id, 'Created user should include a generated ID').toBeTruthy();
        expect(body).toHaveProperty('id');
    });

    test('PUT - Update user @master @regression @api', async ({ request }) => {
        const route = replaceRouteParams(Routes.UPDATE_USER, { id: USER_ID });
        const payload = RandomDataUtil.generateUserUpdatePayload();
        const response = await request.put(`${BASE_URL}${route}`, { data: payload });

        expect(response.status(), 'Expected status 200 when updating a user').toBe(200);

        const body = await response.json();
        expect(body.username, 'Updated username should match payload').toBe(payload.username);
        expect(body.email, 'Updated email should match payload').toBe(payload.email);
        expect(body.name.firstname, 'First name should match payload').toBe(payload.name.firstname);
        expect(body.name.lastname, 'Last name should match payload').toBe(payload.name.lastname);
    });

    test('DELETE - Delete user @master @regression @api', async ({ request }) => {
        const route = replaceRouteParams(Routes.DELETE_USER, { id: USER_ID });
        const response = await request.delete(`${BASE_URL}${route}`);

        expect(response.status(), 'Expected status 200 when deleting a user').toBe(200);

        const body = await response.json();
        expect(body === null || typeof body === 'object', 'Delete response should be returned as expected').toBeTruthy();
    });

    test('GET - All carts @master @sanity @api', async ({ request }) => {
        const response = await request.get(`${BASE_URL}${Routes.GET_ALL_CARTS}`);

        expect(response.status(), 'Expected status 200 for all carts request').toBe(200);

        const body = await response.json();
        expect(Array.isArray(body), 'Response should be an array').toBeTruthy();
        expect(body.length, 'Cart array should not be empty').toBeGreaterThan(0);
    });

    test('GET - Cart by ID @master @sanity @api', async ({ request }) => {
        const route = replaceRouteParams(Routes.GET_CART_BY_ID, { id: CART_ID });
        const response = await request.get(`${BASE_URL}${route}`);

        expect(response.status(), 'Expected status 200 for get cart by ID').toBe(200);

        const body = await response.json();
        expect(body.id, 'Returned cart ID should match requested ID').toBe(CART_ID);
        expect(body).toHaveProperty('userId');
        expect(body).toHaveProperty('date');
        expect(body).toHaveProperty('products');
    });

    test('GET - Carts by date range @master @regression @api', async ({ request }) => {
        const route = replaceRouteParams(Routes.GET_CARTS_BY_DATE_RANGE, {
            startdate: START_DATE,
            enddate: END_DATE,
        });
        const response = await request.get(`${BASE_URL}${route}`);

        expect(response.status(), 'Expected status 200 for carts in date range').toBe(200);

        const body = await response.json();
        expect(Array.isArray(body), 'Response should be an array').toBeTruthy();

        for (const cart of body) {
            const cartDate = new Date(cart.date).getTime();
            const start = new Date(START_DATE).getTime();
            const end = new Date(END_DATE).getTime();
            expect(cartDate >= start && cartDate <= end, 'Returned cart date should fall within requested range').toBeTruthy();
        }
    });

    test('GET - User cart @master @regression @api', async ({ request }) => {
        const route = replaceRouteParams(Routes.GET_USER_CART, { userId: USER_ID });
        const response = await request.get(`${BASE_URL}${route}`);

        expect(response.status(), 'Expected status 200 for user cart request').toBe(200);

        const body = await response.json();
        expect(Array.isArray(body), 'Response should be an array').toBeTruthy();
        expect(body.length, 'User cart results should not be empty').toBeGreaterThan(0);

        for (const cart of body) {
            expect(cart.userId, 'Each cart should belong to requested user').toBe(USER_ID);
        }
    });

    test('GET - Carts with limit @master @regression @api', async ({ request }) => {
        const route = replaceRouteParams(Routes.GET_CARTS_WITH_LIMIT, { limit: LIMIT });
        const response = await request.get(`${BASE_URL}${route}`);

        expect(response.status(), 'Expected status 200 for carts with limit').toBe(200);

        const body = await response.json();
        expect(Array.isArray(body), 'Response should be an array').toBeTruthy();
        expect(body.length, `Expected exactly ${LIMIT} cart records`).toBe(LIMIT);
    });

    test('GET - Carts sorted ascending @master @regression @api', async ({ request }) => {
        const route = replaceRouteParams(Routes.GET_CARTS_SORTED, { order: 'asc' });
        const response = await request.get(`${BASE_URL}${route}`);

        expect(response.status(), 'Expected status 200 for ascending cart sort').toBe(200);

        const body = await response.json();
        expect(Array.isArray(body), 'Response should be an array').toBeTruthy();
        const ids = getCartIdList(body);
        expect(ids.every((id, index, array) => index === 0 || array[index - 1] <= id), 'Cart IDs should be sorted ascending').toBeTruthy();
    });

    test('GET - Carts sorted descending @master @regression @api', async ({ request }) => {
        const route = replaceRouteParams(Routes.GET_CARTS_SORTED, { order: 'desc' });
        const response = await request.get(`${BASE_URL}${route}`);

        expect(response.status(), 'Expected status 200 for descending cart sort').toBe(200);

        const body = await response.json();
        expect(Array.isArray(body), 'Response should be an array').toBeTruthy();
        const ids = getCartIdList(body);
        expect(ids.every((id, index, array) => index === 0 || array[index - 1] >= id), 'Cart IDs should be sorted descending').toBeTruthy();
    });

    test('POST - Create cart @master @regression @api', async ({ request }) => {
        const payload = RandomDataUtil.generateCartPayload(USER_ID);
        const response = await request.post(`${BASE_URL}${Routes.CREATE_CART}`, { data: payload });

        expect(response.status(), 'Expected status 201 when creating a cart').toBe(201);

        const body = await response.json();
        expect(body.id, 'Created cart should include a generated ID').toBeTruthy();
        expect(body.userId, 'Returned cart should include the expected user ID').toBe(payload.userId);
        expect(Array.isArray(body.products), 'Cart products should be an array').toBeTruthy();
        expect(body.products.length, 'Cart products array should not be empty').toBeGreaterThan(0);
    });

    test('PUT - Update cart @master @regression @api', async ({ request }) => {
        const route = replaceRouteParams(Routes.UPDATE_CART, { id: CART_ID });
        const payload = RandomDataUtil.generateUpdatedCartPayload(USER_ID);
        const response = await request.put(`${BASE_URL}${route}`, { data: payload });

        expect(response.status(), 'Expected status 200 when updating a cart').toBe(200);

        const body = await response.json();
        expect(body.id, 'Updated cart ID should match requested ID').toBe(CART_ID);
        expect(body.userId, 'Updated cart user ID should match payload').toBe(payload.userId);
        expect(Array.isArray(body.products), 'Updated cart products should be an array').toBeTruthy();
        expect(body.products[0].quantity, 'Updated cart quantity should be reflected in the response').toBe(payload.products[0].quantity);
    });

    test('DELETE - Delete cart @master @regression @api', async ({ request }) => {
        const route = replaceRouteParams(Routes.DELETE_CART, { id: CART_ID });
        const response = await request.delete(`${BASE_URL}${route}`);

        expect(response.status(), 'Expected status 200 when deleting a cart').toBe(200);

        const body = await response.json();
        expect(body, 'Delete response body should be present').toBeTruthy();
    });

    test('GET - Product response schema @master @regression @api', async ({ request }) => {
        const route = replaceRouteParams(Routes.GET_PRODUCT_BY_ID, { id: PRODUCT_ID });
        const response = await request.get(`${BASE_URL}${route}`);

        expect(response.status(), 'Expected status 200 for product schema validation').toBe(200);

        const body = await response.json();
        validateSchema(body, 'product_api_schema.json');
    });

    test('GET - User response schema @master @regression @api', async ({ request }) => {
        const route = replaceRouteParams(Routes.GET_USER_BY_ID, { id: USER_ID });
        const response = await request.get(`${BASE_URL}${route}`);

        expect(response.status(), 'Expected status 200 for user schema validation').toBe(200);

        const body = await response.json();
        validateSchema(body, 'user_api_schema.json');
    });

    test('GET - Cart response schema @master @regression @api', async ({ request }) => {
        const route = replaceRouteParams(Routes.GET_CART_BY_ID, { id: CART_ID });
        const response = await request.get(`${BASE_URL}${route}`);

        expect(response.status(), 'Expected status 200 for cart schema validation').toBe(200);

        const body = await response.json();
        validateSchema(body, 'cart_api_schema.json');
    });

    test('Product CRUD workflow @master @regression @api', async ({ request }) => {
        const createPayload = RandomDataUtil.generateProductPayload();
        const createResponse = await request.post(`${BASE_URL}${Routes.CREATE_PRODUCT}`, { data: createPayload });

        expect(createResponse.status(), 'Expected status 201 when creating the product for workflow').toBe(201);

        const createdProduct = await createResponse.json();
        const productId = createdProduct.id;
        expect(productId, 'Created product should return a valid ID').toBeTruthy();

        const updatePayload = RandomDataUtil.generateUpdatedProductPayload();
        const updateResponse = await request.put(`${BASE_URL}${replaceRouteParams(Routes.UPDATE_PRODUCT, { id: productId })}`, {
            data: updatePayload,
        });

        expect(updateResponse.status(), 'Expected status 200 when updating the created product').toBe(200);

        const updatedProduct = await updateResponse.json();
        expect(updatedProduct.id, 'Updated product ID should match the created product ID').toBe(productId);
        expect(updatedProduct.title, 'Updated product title should match payload').toBe(updatePayload.title);
        expect(updatedProduct.price, 'Updated product price should match payload').toBe(updatePayload.price);

        const deleteResponse = await request.delete(`${BASE_URL}${replaceRouteParams(Routes.DELETE_PRODUCT, { id: productId })}`);
        expect(deleteResponse.status(), 'Expected status 200 when deleting the created product').toBe(200);
    });

    test('User CRUD workflow @master @regression @api', async ({ request }) => {
        const createPayload = RandomDataUtil.generateUserPayload();
        const createResponse = await request.post(`${BASE_URL}${Routes.CREATE_USER}`, { data: createPayload });

        expect(createResponse.status(), 'Expected status 201 when creating the user for workflow').toBe(201);

        const createdUser = await createResponse.json();
        const userId = createdUser.id;
        expect(userId, 'Created user should return a valid ID').toBeTruthy();

        const updatePayload = RandomDataUtil.generateUserUpdatePayload();
        const updateResponse = await request.put(`${BASE_URL}${replaceRouteParams(Routes.UPDATE_USER, { id: userId })}`, {
            data: updatePayload,
        });

        expect(updateResponse.status(), 'Expected status 200 when updating the created user').toBe(200);

        const updatedUser = await updateResponse.json();
        expect(updatedUser.username, 'Updated username should match payload').toBe(updatePayload.username);
        expect(updatedUser.email, 'Updated email should match payload').toBe(updatePayload.email);

        const deleteResponse = await request.delete(`${BASE_URL}${replaceRouteParams(Routes.DELETE_USER, { id: userId })}`);
        expect(deleteResponse.status(), 'Expected status 200 when deleting the created user').toBe(200);
    });

    test('Cart CRUD workflow @master @regression @api', async ({ request }) => {
        const createPayload = RandomDataUtil.generateCartPayload(USER_ID);
        const createResponse = await request.post(`${BASE_URL}${Routes.CREATE_CART}`, { data: createPayload });

        expect(createResponse.status(), 'Expected status 201 when creating the cart for workflow').toBe(201);

        const createdCart = await createResponse.json();
        const cartId = createdCart.id;
        expect(cartId, 'Created cart should return a valid ID').toBeTruthy();
        expect(createdCart.userId, 'Created cart userId should match payload').toBe(createPayload.userId);
        expect(Array.isArray(createdCart.products), 'Created cart should contain products').toBeTruthy();

        const updatePayload = RandomDataUtil.generateUpdatedCartPayload(USER_ID);
        const updateResponse = await request.put(`${BASE_URL}${replaceRouteParams(Routes.UPDATE_CART, { id: cartId })}`, {
            data: updatePayload,
        });

        expect(updateResponse.status(), 'Expected status 200 when updating the created cart').toBe(200);

        const updatedCart = await updateResponse.json();
        expect(updatedCart.id, 'Updated cart ID should match created cart ID').toBe(cartId);
        expect(updatedCart.products[0].quantity, 'Updated cart quantity should match payload').toBe(updatePayload.products[0].quantity);

        const deleteResponse = await request.delete(`${BASE_URL}${replaceRouteParams(Routes.DELETE_CART, { id: cartId })}`);
        expect(deleteResponse.status(), 'Expected status 200 when deleting the created cart').toBe(200);
    });
});
